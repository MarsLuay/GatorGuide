const fs = require("fs");
const path = require("path");

const TMP_CATEGORY_NAMES = [
  "reports",
  "snapshots",
  "error_logs",
  "logs",
  "exports",
  "cache",
  "downloads",
  "screenshots",
  "scratch",
  "qa",
  "builds",
];

const TMP_CATEGORY_SET = new Set(TMP_CATEGORY_NAMES);

function normalizeName(value) {
  return String(value ?? "").replace(/\\/g, "/").split("/")[0].toLowerCase();
}

function getTmpCategory(name) {
  const normalized = normalizeName(name);
  const extension = path.extname(normalized);

  if (TMP_CATEGORY_SET.has(normalized)) {
    return normalized;
  }

  if (
    normalized.includes("error") ||
    normalized.endsWith(".err") ||
    normalized.endsWith(".err.log")
  ) {
    return "error_logs";
  }

  if (
    normalized.includes("log") ||
    normalized.endsWith(".out") ||
    normalized.endsWith(".out.log")
  ) {
    return "logs";
  }

  if (
    normalized.includes("screenshot") ||
    normalized.includes("screen-shot") ||
    [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(extension)
  ) {
    return "screenshots";
  }

  if (normalized.includes("snapshot")) {
    return "snapshots";
  }

  if (
    normalized.includes("download") ||
    normalized.includes("annual-schedule") ||
    [".pdf", ".docx", ".zip"].includes(extension)
  ) {
    return "downloads";
  }

  if (
    normalized.includes("export") ||
    normalized.includes("fact-check") ||
    [".csv", ".xlsx"].includes(extension)
  ) {
    return "exports";
  }

  if (normalized.includes("cache")) {
    return "cache";
  }

  if (normalized.includes("qa")) {
    return "qa";
  }

  if (
    normalized.includes("build") ||
    normalized.includes("dist") ||
    normalized.includes("bundle")
  ) {
    return "builds";
  }

  if (
    normalized.includes("report") ||
    normalized.includes("audit") ||
    normalized.includes("summary") ||
    normalized.includes("diagnosis") ||
    normalized.includes("status") ||
    normalized.includes("validation") ||
    normalized.includes("coverage") ||
    normalized.includes("planner") ||
    normalized.includes("deadline") ||
    normalized.includes("catalog") ||
    [".json", ".md", ".html", ".txt"].includes(extension)
  ) {
    return "reports";
  }

  return "scratch";
}

function createTmpLayout(projectRoot) {
  const root = path.resolve(projectRoot, ".tmp");
  const layout = { root };

  for (const name of TMP_CATEGORY_NAMES) {
    layout[name] = path.join(root, name);
  }

  return layout;
}

function ensureTmpLayout(projectRoot) {
  const layout = createTmpLayout(projectRoot);
  fs.mkdirSync(layout.root, { recursive: true });

  for (const name of TMP_CATEGORY_NAMES) {
    fs.mkdirSync(layout[name], { recursive: true });
  }

  return layout;
}

function getTmpPath(projectRoot, ...segments) {
  const layout = ensureTmpLayout(projectRoot);
  if (segments.length === 0) {
    return layout.root;
  }

  const [firstSegment, ...remainingSegments] = segments.map(String);
  const normalizedFirst = normalizeName(firstSegment);

  if (TMP_CATEGORY_SET.has(normalizedFirst)) {
    return path.join(layout.root, firstSegment, ...remainingSegments);
  }

  const category = getTmpCategory(firstSegment);
  return path.join(layout[category], firstSegment, ...remainingSegments);
}

function getLegacyTmpPath(projectRoot, ...segments) {
  return path.join(path.resolve(projectRoot, ".tmp"), ...segments.map(String));
}

function resolveTmpPath(projectRoot, ...segments) {
  const categorizedPath = getTmpPath(projectRoot, ...segments);
  if (fs.existsSync(categorizedPath)) {
    return categorizedPath;
  }

  const legacyPath = getLegacyTmpPath(projectRoot, ...segments);
  if (fs.existsSync(legacyPath)) {
    return legacyPath;
  }

  return categorizedPath;
}

module.exports = {
  TMP_CATEGORY_NAMES,
  createTmpLayout,
  ensureTmpLayout,
  getLegacyTmpPath,
  getTmpCategory,
  getTmpPath,
  resolveTmpPath,
};
