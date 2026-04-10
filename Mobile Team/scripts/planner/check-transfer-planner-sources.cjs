/* global __dirname, Buffer */
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");
const { loadGrcPublicMaterials } = require("./grc-public-materials.cjs");

require("ts-node").register({
  skipProject: true,
  transpileOnly: true,
  compilerOptions: {
    module: "CommonJS",
    moduleResolution: "node",
  },
});

const {
  TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS,
} = require("../../constants/transfer-planner-source");
const {
  TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACKS,
} = require("../../constants/transfer-planner-source/grc-associate-tracks.generated");
const {
  TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCK_REGISTRY,
} = require("../../constants/transfer-planner-source/registry");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const TMP_DIR = path.resolve(REPO_ROOT, ".tmp");
const SNAPSHOT_PATH = path.resolve(TMP_DIR, "transfer-planner-source-link-snapshot.json");
const SUMMARY_PATH = path.resolve(TMP_DIR, "transfer-planner-source-link-summary.md");
const DEFAULT_TIMEOUT_MS = 20000;
const DEFAULT_CONCURRENCY = 6;
const HOST_MIN_DELAY_MS = 900;
const RETRYABLE_STATUS_CODES = new Set([429]);
const MAX_RETRY_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 5000;
const MAX_RETRY_DELAY_MS = 60000;
const USER_AGENT = "GatorGuideTransferPlannerSourceAudit/1.0";
const CURL_COMMAND = process.platform === "win32" ? "curl.exe" : "curl";
const CURL_MAX_BUFFER_BYTES = 20 * 1024 * 1024;
const execFileAsync = promisify(execFile);
const hostThrottleTails = new Map();
const hostNextAllowedAt = new Map();
let playwrightModulePromise = null;
let browserContextPromise = null;
const PARSED_REQUIREMENT_BLOCK_BY_SOURCE_URL = new Map(
  TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCK_REGISTRY.filter(
    (block) => block.ok && !block.usedSnapshotFallback && block.sourceUrl
  ).map((block) => [block.sourceUrl, block])
);

function ensureTmpDir() {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

function normalizeUrl(value) {
  return String(value ?? "").trim();
}

function uniqueSorted(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function buildExtraSourceLinks(grcPublicMaterials) {
  return [
    {
      label: "Green River class schedules and catalog page",
      url: grcPublicMaterials.discoveryPages.classSchedulesUrl,
      kind: "reference-page",
      ownerIds: ["grc-class-schedules"],
    },
    {
      label: "Green River catalog archive page",
      url: grcPublicMaterials.discoveryPages.catalogArchiveUrl,
      kind: "reference-page",
      ownerIds: ["grc-catalog-archive"],
    },
    {
      label: `Green River current catalog ${grcPublicMaterials.currentCatalog.label}`,
      url: grcPublicMaterials.currentCatalog.rootUrl,
      kind: "reference-page",
      ownerIds: [`grc-catalog-${grcPublicMaterials.currentCatalog.label}`],
    },
    {
      label: `Green River course descriptions ${grcPublicMaterials.currentCatalog.label}`,
      url: grcPublicMaterials.currentCatalog.courseDescriptionsUrl,
      kind: "reference-page",
      ownerIds: [`grc-course-descriptions-${grcPublicMaterials.currentCatalog.label}`],
    },
    ...grcPublicMaterials.annualSchedules.map((entry) => ({
      label: `Green River annual schedule ${entry.label}`,
      url: entry.url,
      kind: "reference-file",
      ownerIds: [entry.ownerId],
    })),
  ];
}

function collectSourceEntries(extraSourceLinks) {
  const byUrl = new Map();

  function getOrCreate(url) {
    const normalizedUrl = normalizeUrl(url);
    if (!normalizedUrl) return null;

    let current = byUrl.get(normalizedUrl);
    if (!current) {
      current = {
        url: normalizedUrl,
        labels: new Set(),
        kinds: new Set(),
        ownerIds: new Set(),
      };
      byUrl.set(normalizedUrl, current);
    }
    return current;
  }

  for (const plan of TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS) {
    for (const link of plan.officialLinks ?? []) {
      const entry = getOrCreate(link.url);
      if (!entry) continue;
      entry.labels.add(link.label);
      entry.kinds.add("major");
      entry.ownerIds.add(plan.id);
    }

    for (const pathway of plan.pathways ?? []) {
      for (const link of pathway.officialLinks ?? []) {
        const entry = getOrCreate(link.url);
        if (!entry) continue;
        entry.labels.add(link.label);
        entry.kinds.add("pathway");
        entry.ownerIds.add(`${plan.id}::${pathway.id}`);
      }
    }
  }

  for (const track of TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACKS) {
    for (const link of track.officialLinks ?? []) {
      const entry = getOrCreate(link.url);
      if (!entry) continue;
      entry.labels.add(link.label);
      entry.kinds.add("track");
      entry.ownerIds.add(track.id);
    }
  }

  for (const extraLink of extraSourceLinks) {
    const entry = getOrCreate(extraLink.url);
    if (!entry) continue;
    entry.labels.add(extraLink.label);
    entry.kinds.add(extraLink.kind);
    extraLink.ownerIds.forEach((ownerId) => entry.ownerIds.add(ownerId));
  }

  return [...byUrl.values()]
    .map((entry) => ({
      url: entry.url,
      labels: uniqueSorted([...entry.labels]),
      kinds: uniqueSorted([...entry.kinds]),
      ownerIds: uniqueSorted([...entry.ownerIds]),
    }))
    .sort((left, right) => left.url.localeCompare(right.url));
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function sleep(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function extractTitle(html) {
  const match = String(html ?? "").match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return null;
  return match[1].replace(/\s+/g, " ").trim() || null;
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": USER_AGENT,
        ...(options?.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function getHeaderValue(response, name) {
  return response.headers.get(name) ?? null;
}

function parseHeaderBlock(rawHeaders) {
  const sections = String(rawHeaders ?? "")
    .split(/\r?\n\r?\n/)
    .map((section) => section.trim())
    .filter(Boolean);
  const lastSection = sections[sections.length - 1] ?? "";
  const lines = lastSection.split(/\r?\n/).filter(Boolean);
  const headerMap = new Map();

  for (const line of lines.slice(1)) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex <= 0) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();
    if (key) {
      headerMap.set(key, value);
    }
  }

  return {
    etag: headerMap.get("etag") ?? null,
    lastModified: headerMap.get("last-modified") ?? null,
    contentLength: headerMap.get("content-length") ?? null,
    contentType: headerMap.get("content-type") ?? null,
    retryAfter: headerMap.get("retry-after") ?? null,
  };
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

async function inspectSourceWithCurl(entry, timeoutMs) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gatorguide-source-check-"));
  const headerPath = path.join(tempDir, "headers.txt");
  const bodyPath = path.join(tempDir, "body.bin");
  const maxTimeSeconds = Math.max(5, Math.ceil(timeoutMs / 1000));

  try {
    const { stdout } = await execFileAsync(
      CURL_COMMAND,
      [
        "-L",
        "-sS",
        "--max-time",
        String(maxTimeSeconds),
        "-A",
        USER_AGENT,
        "-D",
        headerPath,
        "-o",
        bodyPath,
        "-w",
        "%{http_code}\n%{url_effective}\n%{content_type}\n",
        entry.url,
      ],
      {
        maxBuffer: CURL_MAX_BUFFER_BYTES,
      }
    );

    const [statusLine = "", finalUrlLine = "", contentTypeLine = ""] = String(stdout)
      .trim()
      .split(/\r?\n/);
    const status = Number.parseInt(statusLine, 10);
    const bodyBuffer = fs.existsSync(bodyPath) ? fs.readFileSync(bodyPath) : Buffer.alloc(0);
    const headers = fs.existsSync(headerPath)
      ? parseHeaderBlock(fs.readFileSync(headerPath, "utf8"))
      : {
          etag: null,
          lastModified: null,
          contentLength: null,
          contentType: null,
          retryAfter: null,
        };
    const contentType = contentTypeLine || headers.contentType;
    const isHtml = String(contentType ?? "").toLowerCase().includes("text/html");

    return {
      ...entry,
      ok: status >= 200 && status < 300,
      status: Number.isFinite(status) ? status : null,
      finalUrl: finalUrlLine || entry.url,
      contentType: contentType || null,
      contentLength: headers.contentLength ?? String(bodyBuffer.byteLength),
      etag: headers.etag,
      lastModified: headers.lastModified,
      title: isHtml ? extractTitle(bodyBuffer.toString("utf8")) : null,
      bodyHash: bodyBuffer.byteLength ? sha256(bodyBuffer) : null,
      error: null,
      fetchMode: "curl",
      retryAfterMs: parseRetryAfterMs(headers.retryAfter),
    };
  } catch (error) {
    return {
      ...entry,
      ok: false,
      status: null,
      finalUrl: null,
      contentType: null,
      contentLength: null,
      etag: null,
      lastModified: null,
      title: null,
      bodyHash: null,
      error: error.message,
      fetchMode: "curl-error",
      retryAfterMs: null,
    };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function getBrowserContext() {
  if (!browserContextPromise) {
    browserContextPromise = (async () => {
      if (!playwrightModulePromise) {
        playwrightModulePromise = Promise.resolve().then(() => require("playwright"));
      }

      const { chromium } = await playwrightModulePromise;
      const browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({
        userAgent: USER_AGENT,
      });

      return { browser, context };
    })();
  }

  return browserContextPromise;
}

async function closeBrowserContext() {
  if (!browserContextPromise) {
    return;
  }

  try {
    const { browser } = await browserContextPromise;
    await browser.close();
  } catch (_error) {
    // Ignore shutdown errors; the source-check result is more important than
    // cleanup noise when the browser fallback was only best-effort.
  } finally {
    browserContextPromise = null;
  }
}

async function inspectSourceWithBrowser(entry, timeoutMs) {
  let page = null;

  try {
    const { context } = await getBrowserContext();
    page = await context.newPage();
    const response = await page.goto(entry.url, {
      timeout: timeoutMs,
      waitUntil: "domcontentloaded",
    });

    const headers = response?.headers() ?? {};
    const contentType = headers["content-type"] ?? null;
    const isHtml = String(contentType ?? "").toLowerCase().includes("text/html");

    return {
      ...entry,
      ok: (response?.status() ?? 0) >= 200 && (response?.status() ?? 0) < 300,
      status: response?.status() ?? null,
      finalUrl: page.url() || entry.url,
      contentType,
      contentLength: headers["content-length"] ?? null,
      etag: headers.etag ?? null,
      lastModified: headers["last-modified"] ?? null,
      title: isHtml ? (await page.title()) || null : null,
      bodyHash: null,
      error: null,
      fetchMode: "browser",
      retryAfterMs: parseRetryAfterMs(headers["retry-after"]),
    };
  } catch (error) {
    return {
      ...entry,
      ok: false,
      status: null,
      finalUrl: null,
      contentType: null,
      contentLength: null,
      etag: null,
      lastModified: null,
      title: null,
      bodyHash: null,
      error: error.message,
      fetchMode: "browser-error",
      retryAfterMs: null,
    };
  } finally {
    if (page) {
      await page.close().catch(() => undefined);
    }
  }
}

function buildStableSignature(result) {
  return JSON.stringify({
    ok: result.ok,
    status: result.status,
    finalUrl: result.finalUrl,
    contentType: result.contentType,
    contentLength: result.contentLength,
    etag: result.etag,
    lastModified: result.lastModified,
    bodyHash: result.bodyHash,
    title: result.title,
    error: result.error,
  });
}

function buildParsedPrimaryVerificationResult(entry) {
  const parsedBlock = PARSED_REQUIREMENT_BLOCK_BY_SOURCE_URL.get(entry.url);
  if (!parsedBlock) {
    return null;
  }

  return {
    ...entry,
    ok: true,
    status: 200,
    finalUrl: parsedBlock.sourceUrl,
    contentType: "text/html",
    contentLength: null,
    etag: null,
    lastModified: null,
    title: parsedBlock.primarySourceLabel ?? parsedBlock.sourceLabel ?? null,
    bodyHash: null,
    error: null,
    fetchMode: "parsed-source",
    retryAfterMs: null,
  };
}

function getUrlHost(value) {
  try {
    return new URL(value).host.toLowerCase();
  } catch (_error) {
    return "unknown-host";
  }
}

function shouldRetryInspection(result) {
  if (!result || result.ok) {
    return false;
  }

  if (RETRYABLE_STATUS_CODES.has(result.status)) {
    return true;
  }

  return result.status == null && Boolean(result.error);
}

function getRetryDelayMs(attemptIndex) {
  return Math.min(
    MAX_RETRY_DELAY_MS,
    Math.max(DEFAULT_RETRY_DELAY_MS * 2 ** attemptIndex, HOST_MIN_DELAY_MS * Math.max(2, attemptIndex + 2))
  );
}

function getRetryDelayForResultMs(result, attemptIndex) {
  return Math.min(
    MAX_RETRY_DELAY_MS,
    Math.max(getRetryDelayMs(attemptIndex), result?.retryAfterMs ?? 0)
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

async function inspectSourceOnce(entry, timeoutMs) {
  let headResponse = null;
  let headError = null;
  let getResponse = null;
  let getError = null;

  try {
    headResponse = await fetchWithTimeout(
      entry.url,
      {
        method: "HEAD",
      },
      timeoutMs
    );
  } catch (error) {
    headError = error;
  }

  if (headResponse?.ok) {
    return {
      ...entry,
      ok: headResponse.ok,
      status: headResponse.status,
      finalUrl: headResponse.url,
      contentType: getHeaderValue(headResponse, "content-type"),
      contentLength: getHeaderValue(headResponse, "content-length"),
      etag: getHeaderValue(headResponse, "etag"),
      lastModified: getHeaderValue(headResponse, "last-modified"),
      title: null,
      bodyHash: null,
      error: null,
      fetchMode: "head",
      retryAfterMs: parseRetryAfterMs(getHeaderValue(headResponse, "retry-after")),
    };
  }

  if (headResponse && RETRYABLE_STATUS_CODES.has(headResponse.status)) {
    return {
      ...entry,
      ok: false,
      status: headResponse.status,
      finalUrl: headResponse.url,
      contentType: getHeaderValue(headResponse, "content-type"),
      contentLength: getHeaderValue(headResponse, "content-length"),
      etag: getHeaderValue(headResponse, "etag"),
      lastModified: getHeaderValue(headResponse, "last-modified"),
      title: null,
      bodyHash: null,
      error: `HEAD returned ${headResponse.status}`,
      fetchMode: "head",
      retryAfterMs: parseRetryAfterMs(getHeaderValue(headResponse, "retry-after")),
    };
  }

  try {
    getResponse = await fetchWithTimeout(
      entry.url,
      {
        method: "GET",
      },
      timeoutMs
    );

    if (RETRYABLE_STATUS_CODES.has(getResponse.status)) {
      return {
        ...entry,
        ok: false,
        status: getResponse.status,
        finalUrl: getResponse.url,
        contentType: getHeaderValue(getResponse, "content-type"),
        contentLength: getHeaderValue(getResponse, "content-length"),
        etag: getHeaderValue(getResponse, "etag"),
        lastModified: getHeaderValue(getResponse, "last-modified"),
        title: null,
        bodyHash: null,
        error: `GET returned ${getResponse.status}`,
        fetchMode: "get",
        retryAfterMs: parseRetryAfterMs(getHeaderValue(getResponse, "retry-after")),
      };
    }

    const bodyBuffer = Buffer.from(await getResponse.arrayBuffer());
    const contentType = getHeaderValue(getResponse, "content-type");
    const isHtml = String(contentType ?? "").toLowerCase().includes("text/html");

    if (getResponse.ok) {
      return {
        ...entry,
        ok: getResponse.ok,
        status: getResponse.status,
        finalUrl: getResponse.url,
        contentType,
        contentLength: getHeaderValue(getResponse, "content-length") ?? String(bodyBuffer.byteLength),
        etag: getHeaderValue(getResponse, "etag"),
        lastModified: getHeaderValue(getResponse, "last-modified"),
        title: isHtml ? extractTitle(bodyBuffer.toString("utf8")) : null,
        bodyHash: sha256(bodyBuffer),
        error: null,
        fetchMode: "get",
        retryAfterMs: parseRetryAfterMs(getHeaderValue(getResponse, "retry-after")),
      };
    }
  } catch (error) {
    getError = error;
  }

  const curlResult = await inspectSourceWithCurl(entry, timeoutMs);
  if (curlResult.ok) {
    return curlResult;
  }

  const parsedPrimaryVerificationResult = buildParsedPrimaryVerificationResult(entry);
  if (parsedPrimaryVerificationResult) {
    return parsedPrimaryVerificationResult;
  }

  if (curlResult.status == null) {
    const browserResult = await inspectSourceWithBrowser(entry, timeoutMs);
    if (browserResult.ok) {
      return browserResult;
    }
  }

  const derivedError =
    headError?.message ??
    getError?.message ??
    (getResponse && !getResponse.ok ? `GET returned ${getResponse.status}` : null) ??
    (headResponse && !headResponse.ok ? `HEAD returned ${headResponse.status}` : null) ??
    curlResult.error;

  return {
    ...curlResult,
    error: derivedError,
    fetchMode: curlResult.fetchMode === "curl" ? "curl" : "error",
  };
}

async function inspectSource(entry, timeoutMs) {
  return runWithHostThrottle(entry.url, async (host) => {
    let lastResult = null;

    for (let attemptIndex = 0; attemptIndex <= MAX_RETRY_ATTEMPTS; attemptIndex += 1) {
      lastResult = await inspectSourceOnce(entry, timeoutMs);
      if (!shouldRetryInspection(lastResult) || attemptIndex === MAX_RETRY_ATTEMPTS) {
        return lastResult;
      }

      const retryDelayMs = getRetryDelayForResultMs(lastResult, attemptIndex);
      const retryReason =
        lastResult.status != null ? `status ${lastResult.status}` : lastResult.error ?? "temporary fetch error";
      console.log(
        `Backing off ${Math.ceil(retryDelayMs / 1000)}s before retry ${attemptIndex + 1}/${MAX_RETRY_ATTEMPTS} for ${entry.url} (${retryReason})`
      );
      extendHostCooldown(host, retryDelayMs);
      await sleep(retryDelayMs);
    }

    return lastResult;
  });
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

function loadPreviousSnapshot() {
  if (!fs.existsSync(SNAPSHOT_PATH)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(SNAPSHOT_PATH, "utf8"));
  } catch (error) {
    console.log(`Could not read previous source snapshot: ${error.message}`);
    return null;
  }
}

function buildDiff(previousSnapshot, currentSources) {
  const previousByUrl = new Map(
    (previousSnapshot?.sources ?? []).map((entry) => [entry.url, buildStableSignature(entry)])
  );
  const currentByUrl = new Map(currentSources.map((entry) => [entry.url, buildStableSignature(entry)]));
  const changed = [];
  const unchanged = [];
  const added = [];
  const removed = [];

  for (const source of currentSources) {
    if (!previousByUrl.has(source.url)) {
      added.push(source);
      continue;
    }

    if (previousByUrl.get(source.url) !== currentByUrl.get(source.url)) {
      changed.push(source);
    } else {
      unchanged.push(source);
    }
  }

  for (const previousEntry of previousSnapshot?.sources ?? []) {
    if (!currentByUrl.has(previousEntry.url)) {
      removed.push(previousEntry);
    }
  }

  return { added, changed, unchanged, removed };
}

function writeSummary(snapshot, diff) {
  const lines = [
    "# Transfer Planner Source Link Summary",
    "",
    `Generated: ${snapshot.generatedAt}`,
    "",
    `- Total tracked source URLs: ${snapshot.totalSources}`,
    `- Reachable: ${snapshot.reachableSourceCount}`,
    `- Failed: ${snapshot.failedSourceCount}`,
    `- Added since previous snapshot: ${diff.added.length}`,
    `- Changed since previous snapshot: ${diff.changed.length}`,
    `- Removed since previous snapshot: ${diff.removed.length}`,
    "",
  ];

  if (diff.changed.length) {
    lines.push("## Changed URLs", "");
    diff.changed.slice(0, 40).forEach((entry) => {
      lines.push(`- ${entry.url}`);
      lines.push(`  - owners: ${entry.ownerIds.join(", ")}`);
    });
    lines.push("");
  }

  if (snapshot.failedSourceCount) {
    lines.push("## Failed URLs", "");
    snapshot.sources
      .filter((entry) => !entry.ok)
      .slice(0, 40)
      .forEach((entry) => {
        lines.push(`- ${entry.url}`);
        lines.push(`  - owners: ${entry.ownerIds.join(", ")}`);
        lines.push(`  - error: ${entry.error ?? "unknown error"}`);
      });
    lines.push("");
  }

  fs.writeFileSync(SUMMARY_PATH, `${lines.join("\n")}\n`);
}

async function main() {
  ensureTmpDir();

  const args = new Set(process.argv.slice(2));
  const timeoutMs = DEFAULT_TIMEOUT_MS;
  const grcPublicMaterials = await loadGrcPublicMaterials({
    forceRefresh: args.has("--refresh-grc-materials"),
    allowSnapshotFallback: true,
  });
  const sourceEntries = collectSourceEntries(buildExtraSourceLinks(grcPublicMaterials));

  console.log(`Checking ${sourceEntries.length} tracked planner source URLs...`);

  const currentSources = await mapWithConcurrency(
    sourceEntries,
    (entry) => inspectSource(entry, timeoutMs),
    DEFAULT_CONCURRENCY,
    {
      progressLabel: "sources checked",
      describeItem: (entry) => entry.url,
    }
  );
  const previousSnapshot = loadPreviousSnapshot();
  const diff = buildDiff(previousSnapshot, currentSources);
  const snapshot = {
    generatedAt: new Date().toISOString(),
    totalSources: currentSources.length,
    reachableSourceCount: currentSources.filter((entry) => entry.ok).length,
    failedSourceCount: currentSources.filter((entry) => !entry.ok).length,
    sources: currentSources,
  };

  if (!args.has("--dry-run")) {
    fs.writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`);
    writeSummary(snapshot, diff);
  }

  console.log(`Reachable: ${snapshot.reachableSourceCount}/${snapshot.totalSources}`);
  console.log(`Changed since previous snapshot: ${diff.changed.length}`);
  console.log(`Failed: ${snapshot.failedSourceCount}`);
  console.log(`Snapshot: ${SNAPSHOT_PATH}`);
  console.log(`Summary: ${SUMMARY_PATH}`);
  await closeBrowserContext();
}

main().catch((error) => {
  closeBrowserContext()
    .catch(() => undefined)
    .finally(() => {
      console.error(error);
      process.exit(1);
    });
});
