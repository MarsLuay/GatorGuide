const crypto = require("crypto");
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
  TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS,
  TRANSFER_PLANNER_TRACKS,
} = require("../../constants/transfer-planner-source");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const TMP_DIR = path.resolve(REPO_ROOT, ".tmp");
const SNAPSHOT_PATH = path.resolve(TMP_DIR, "transfer-planner-source-link-snapshot.json");
const SUMMARY_PATH = path.resolve(TMP_DIR, "transfer-planner-source-link-summary.md");
const DEFAULT_TIMEOUT_MS = 20000;
const DEFAULT_CONCURRENCY = 6;
const USER_AGENT = "GatorGuideTransferPlannerSourceAudit/1.0";
const EXTRA_SOURCE_LINKS = [
  {
    label: "Green River annual schedule 2024-2025",
    url: "https://www.greenriver.edu/students/media/documents/schedules-and-catalog/2024-2025-Annual-Schedule.pdf",
    kind: "reference-file",
    ownerIds: ["grc-annual-schedule-2024-2025"],
  },
  {
    label: "Green River annual schedule 2025-2026",
    url: "https://www.greenriver.edu/students/media/documents/schedules-and-catalog/2025-2026%20Annual%20Schedule%20w%20Cover.pdf",
    kind: "reference-file",
    ownerIds: ["grc-annual-schedule-2025-2026"],
  },
];

function ensureTmpDir() {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

function normalizeUrl(value) {
  return String(value ?? "").trim();
}

function uniqueSorted(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function collectSourceEntries() {
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

  for (const track of TRANSFER_PLANNER_TRACKS) {
    for (const link of track.officialLinks ?? []) {
      const entry = getOrCreate(link.url);
      if (!entry) continue;
      entry.labels.add(link.label);
      entry.kinds.add("track");
      entry.ownerIds.add(track.id);
    }
  }

  for (const extraLink of EXTRA_SOURCE_LINKS) {
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

async function inspectSource(entry, timeoutMs) {
  let headResponse = null;
  let headError = null;

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

  const usefulHead =
    headResponse &&
    (getHeaderValue(headResponse, "etag") ||
      getHeaderValue(headResponse, "last-modified") ||
      getHeaderValue(headResponse, "content-length"));

  if (headResponse && (headResponse.ok || usefulHead)) {
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
    };
  }

  try {
    const getResponse = await fetchWithTimeout(
      entry.url,
      {
        method: "GET",
      },
      timeoutMs
    );
    const bodyBuffer = Buffer.from(await getResponse.arrayBuffer());
    const contentType = getHeaderValue(getResponse, "content-type");
    const isHtml = String(contentType ?? "").toLowerCase().includes("text/html");

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
      error: headError?.message ?? error.message,
      fetchMode: "error",
    };
  }
}

async function mapWithConcurrency(items, worker, concurrency) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= items.length) {
        return;
      }
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
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
    console.warn(`Could not read previous source snapshot: ${error.message}`);
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
  const sourceEntries = collectSourceEntries();

  console.log(`Checking ${sourceEntries.length} tracked planner source URLs...`);

  const currentSources = await mapWithConcurrency(
    sourceEntries,
    (entry) => inspectSource(entry, timeoutMs),
    DEFAULT_CONCURRENCY
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
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
