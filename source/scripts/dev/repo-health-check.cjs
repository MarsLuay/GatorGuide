#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { TMP_CATEGORY_NAMES } = require("../lib/tmp-layout.cjs");

const projectRoot = path.resolve(__dirname, "..", "..");
const staleLogAgeMs = 1000 * 60 * 60 * 24 * 3;
const activeCodexVerificationAgeMs = 1000 * 60 * 60 * 24;
const tmpCategorySet = new Set(TMP_CATEGORY_NAMES);
const lockErrorCodes = new Set(["EBUSY", "EPERM", "EACCES"]);
const activeCodexVerificationDirectoryPattern = /^codex-verify(?:[._-].*)?$/i;

function packagePath(...parts) {
  return path.join(projectRoot, "node_modules", ...parts);
}

function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch (error) {
    return false;
  }
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function relativePath(filePath) {
  return path.relative(projectRoot, filePath).replace(/\\/g, "/");
}

function relativePathFrom(rootPath, filePath) {
  return path.relative(rootPath, filePath).replace(/\\/g, "/");
}

function walkFiles(rootPath, extensions, results = [], options = {}) {
  if (!fileExists(rootPath)) {
    return results;
  }

  for (const entry of fs.readdirSync(rootPath, { withFileTypes: true })) {
    const fullPath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      if (!options.skipDirectoryNames?.has(entry.name)) {
        walkFiles(fullPath, extensions, results, options);
      }
      continue;
    }

    if (!extensions || extensions.has(path.extname(entry.name))) {
      results.push(fullPath);
    }
  }

  return results;
}

function listDirectory(rootPath) {
  try {
    return fs.readdirSync(rootPath, { withFileTypes: true });
  } catch {
    return [];
  }
}

function statPath(filePath) {
  try {
    return fs.statSync(filePath);
  } catch {
    return null;
  }
}

function formatAge(ageMs) {
  if (!Number.isFinite(ageMs) || ageMs < 0) {
    return "just now";
  }

  const minuteMs = 1000 * 60;
  const hourMs = minuteMs * 60;
  const dayMs = hourMs * 24;
  if (ageMs >= dayMs) {
    const days = Math.floor(ageMs / dayMs);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }
  if (ageMs >= hourMs) {
    const hours = Math.floor(ageMs / hourMs);
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  if (ageMs >= minuteMs) {
    const minutes = Math.floor(ageMs / minuteMs);
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }
  return "less than a minute ago";
}

function isLockError(error) {
  return Boolean(error && lockErrorCodes.has(error.code));
}

function detectFileLock(filePath) {
  let handle = null;
  try {
    handle = fs.openSync(filePath, "r+");
    return {
      locked: false,
      message: null,
    };
  } catch (error) {
    if (isLockError(error)) {
      return {
        locked: true,
        message: error instanceof Error ? error.message : String(error),
      };
    }
    return {
      locked: false,
      message: null,
    };
  } finally {
    if (handle !== null) {
      try {
        fs.closeSync(handle);
      } catch {
        // Closing a best-effort lock probe should not affect the health result.
      }
    }
  }
}

function findLockedTempArtifact(rootPath, options = {}) {
  const detectLock = options.detectLock ?? detectFileLock;
  const maxFiles = options.maxFiles ?? 100;
  const stack = [rootPath];
  let visitedFiles = 0;

  while (stack.length) {
    const currentPath = stack.pop();
    const currentStat = statPath(currentPath);
    if (!currentStat) {
      continue;
    }

    if (currentStat.isFile()) {
      visitedFiles += 1;
      const lockState = detectLock(currentPath);
      if (lockState.locked) {
        return {
          path: currentPath,
          message: lockState.message,
        };
      }
      if (visitedFiles >= maxFiles) {
        return null;
      }
      continue;
    }

    if (!currentStat.isDirectory()) {
      continue;
    }

    let entries;
    try {
      entries = fs.readdirSync(currentPath, { withFileTypes: true });
    } catch (error) {
      if (isLockError(error)) {
        return {
          path: currentPath,
          message: error instanceof Error ? error.message : String(error),
        };
      }
      continue;
    }

    for (const entry of entries) {
      if (entry.name === "node_modules") {
        continue;
      }
      stack.push(path.join(currentPath, entry.name));
    }
  }

  return null;
}

function getNewestMtimeMs(rootPath, options = {}) {
  const maxEntries = options.maxEntries ?? 200;
  const stack = [rootPath];
  let newestMtimeMs = 0;
  let visitedEntries = 0;

  while (stack.length && visitedEntries < maxEntries) {
    const currentPath = stack.pop();
    const currentStat = statPath(currentPath);
    if (!currentStat) {
      continue;
    }

    visitedEntries += 1;
    newestMtimeMs = Math.max(newestMtimeMs, currentStat.mtimeMs);

    if (!currentStat.isDirectory()) {
      continue;
    }

    for (const entry of listDirectory(currentPath)) {
      if (entry.name === "node_modules") {
        continue;
      }
      stack.push(path.join(currentPath, entry.name));
    }
  }

  return newestMtimeMs;
}

function classifyCodexVerificationTempDirectory(entry, tmpRoot, rootPath, options = {}) {
  if (!entry.isDirectory() || !activeCodexVerificationDirectoryPattern.test(entry.name)) {
    return null;
  }

  const nowMs = options.nowMs ?? Date.now();
  const entryPath = path.join(tmpRoot, entry.name);
  const newestMtimeMs = getNewestMtimeMs(entryPath);
  const ageMs = newestMtimeMs ? nowMs - newestMtimeMs : Number.POSITIVE_INFINITY;
  const lockedArtifact = findLockedTempArtifact(entryPath, {
    detectLock: options.detectLock,
  });

  if (lockedArtifact) {
    return {
      active: true,
      detail: `Locked temp artifact: ${relativePathFrom(rootPath, lockedArtifact.path)} (inside .tmp/${entry.name})`,
    };
  }

  if (ageMs <= activeCodexVerificationAgeMs) {
    return {
      active: true,
      detail: `Active Codex verification temp directory: .tmp/${entry.name} (modified ${formatAge(ageMs)})`,
    };
  }

  return {
    active: false,
    detail: `Stale Codex verification temp directory: .tmp/${entry.name} (last modified ${formatAge(ageMs)})`,
  };
}

function limitDetails(items, formatter, max = 12) {
  const visible = items.slice(0, max).map(formatter);
  if (items.length > max) {
    visible.push(`...and ${items.length - max} more`);
  }
  return visible;
}

function makeSuccess(id, message, details = []) {
  return { id, ok: true, message, details };
}

function makeFailure(id, message, details = [], fix = []) {
  return { id, ok: false, message, details, fix };
}

function checkRequiredFiles() {
  const requiredPaths = [
    "package.json",
    "metro.config.js",
    "babel.config.js",
    "tailwind.config.js",
    path.join("services", "app", "config.ts"),
  ];

  const missing = requiredPaths.filter((relativePath) => {
    return !fileExists(path.join(projectRoot, relativePath));
  });

  if (!missing.length) {
    return makeSuccess(
      "required-files",
      "Required Expo and app config files are present."
    );
  }

  return makeFailure(
    "required-files",
    "Required project files are missing.",
    missing.map((missingPath) => `Missing: ${missingPath}`),
    ["Restore the missing files or re-checkout the source app folder."]
  );
}

function checkBabelCoreInstall() {
  const babelCoreRoot = packagePath("@babel", "core");
  const packageJsonPath = path.join(babelCoreRoot, "package.json");

  if (!fileExists(packageJsonPath)) {
    return makeFailure(
      "babel-core-present",
      "@babel/core is not installed.",
      [],
      ["Run `npm install` from `source`."]
    );
  }

  const suspiciousMatches = [];
  const filesToScan = [
    ...walkFiles(path.join(babelCoreRoot, "lib"), new Set([".js"])),
    ...walkFiles(path.join(babelCoreRoot, "src"), new Set([".ts", ".js"])),
  ];

  const suspiciousPattern = /@\/(?:app|components|constants|hooks|services|utils)\//;

  for (const filePath of filesToScan) {
    const contents = readText(filePath);
    if (!suspiciousPattern.test(contents)) {
      continue;
    }

    suspiciousMatches.push(relativePath(filePath));
    if (suspiciousMatches.length >= 6) {
      break;
    }
  }

  if (!suspiciousMatches.length) {
    const version = JSON.parse(readText(packageJsonPath)).version;
    return makeSuccess(
      "babel-core-clean",
      `@babel/core looks healthy (version ${version}).`
    );
  }

  return makeFailure(
    "babel-core-clean",
    "@babel/core appears to be contaminated with app-specific imports.",
    [
      "This usually means a local node_modules file was accidentally overwritten.",
      ...suspiciousMatches.map((match) => `Suspicious file: ${match}`),
    ],
    [
      "Run `Remove-Item -LiteralPath node_modules/@babel/core -Recurse -Force` in PowerShell.",
      "Then run `npm install @babel/core@7.29.0 --no-save` or `npm install`.",
    ]
  );
}

function checkRootScratchFiles() {
  const suspiciousPatterns = [
    {
      pattern: /^(?:chunker|extract\d*|test|translate_[a-z0-9_-]+)\.(?:js|cjs|mjs|ts)$/i,
      reason: "scratch script",
    },
    {
      pattern: /^(?:out_chunk\d+|untranslated_keys)\.(?:txt|json)$/i,
      reason: "scratch output",
    },
    {
      pattern: /^(?:firebase|firestore|storage)-debug\.log$/i,
      reason: "local emulator debug log",
    },
    {
      pattern: /^\.(?:DS_Store|Spotlight-V100|Trashes)$/i,
      reason: "platform metadata",
    },
  ];

  const matches = listDirectory(projectRoot)
    .filter((entry) => entry.isFile())
    .flatMap((entry) => {
      const match = suspiciousPatterns.find((item) => item.pattern.test(entry.name));
      return match
        ? [{
            name: entry.name,
            reason: match.reason,
          }]
        : [];
    });

  if (!matches.length) {
    return makeSuccess(
      "root-scratch-files",
      "No known scratch files or local debug logs are sitting in the source root."
    );
  }

  return makeFailure(
    "root-scratch-files",
    "Scratch files or local debug logs are sitting in the source root.",
    limitDetails(matches, (item) => `${item.name} (${item.reason})`),
    [
      "Move experiments into `.tmp/scratch/` or delete them.",
      "Remove local emulator debug logs after the emulator has stopped.",
    ]
  );
}

function checkTsConfigGeneratedExclusions() {
  const tsconfigPath = path.join(projectRoot, "tsconfig.json");
  if (!fileExists(tsconfigPath)) {
    return makeFailure(
      "tsconfig-generated-exclusions",
      "tsconfig.json is missing.",
      [],
      ["Restore tsconfig.json at the source project root."]
    );
  }

  let tsconfig;
  try {
    tsconfig = JSON.parse(readText(tsconfigPath));
  } catch (error) {
    return makeFailure(
      "tsconfig-generated-exclusions",
      "tsconfig.json could not be parsed.",
      [error instanceof Error ? error.message : String(error)],
      ["Fix tsconfig.json syntax, then rerun `npm run health:repo`."]
    );
  }

  const excludedPaths = Array.isArray(tsconfig.exclude) ? tsconfig.exclude : [];
  const requiredExclusions = [
    "constants/transfer-planner-source/requirement-source-adapters.generated/**/*.ts",
  ];
  const missing = requiredExclusions.filter(
    (requiredPath) => !excludedPaths.includes(requiredPath)
  );

  if (!missing.length) {
    return makeSuccess(
      "tsconfig-generated-exclusions",
      "TypeScript excludes the huge generated planner TS chunks from normal checks."
    );
  }

  return makeFailure(
    "tsconfig-generated-exclusions",
    "TypeScript is configured to include huge generated planner TS chunks.",
    missing.map((item) => `Missing exclude: ${item}`),
    [
      "Keep generated planner data behind small wrappers and JSON chunks.",
      "Add the missing generated-chunk path to tsconfig.json `exclude`.",
    ]
  );
}

function checkTmpLayout(rootPath = projectRoot, options = {}) {
  const tmpRoot = path.join(rootPath, ".tmp");
  const nowMs = options.nowMs ?? Date.now();
  if (!fileExists(tmpRoot)) {
    return makeSuccess(
      "tmp-layout",
      "No .tmp folder exists yet."
    );
  }

  const ignoredActiveArtifacts = [];
  const looseEntries = listDirectory(tmpRoot)
    .filter((entry) => !tmpCategorySet.has(entry.name))
    .flatMap((entry) => {
      const codexVerificationClassification = classifyCodexVerificationTempDirectory(
        entry,
        tmpRoot,
        rootPath,
        options
      );
      if (codexVerificationClassification?.active) {
        ignoredActiveArtifacts.push(codexVerificationClassification.detail);
        return [];
      }

      return [{
        name: entry.name,
        kind: entry.isDirectory() ? "directory" : "file",
        detail: codexVerificationClassification?.detail ?? null,
      }];
    });

  const staleLogCandidates = [
    path.join(tmpRoot, "logs"),
    path.join(tmpRoot, "error_logs"),
  ].flatMap((logRoot) =>
    walkFiles(
      logRoot,
      new Set([".log", ".out", ".err"]),
      [],
      { skipDirectoryNames: new Set(["node_modules"]) }
    )
  ).filter((filePath) => {
    try {
      return nowMs - fs.statSync(filePath).mtimeMs > staleLogAgeMs;
    } catch {
      return false;
    }
  });
  const staleLogs = staleLogCandidates.filter((filePath) => {
    const lockState = (options.detectLock ?? detectFileLock)(filePath);
    if (lockState.locked) {
      ignoredActiveArtifacts.push(
        `Locked temp artifact: ${relativePathFrom(rootPath, filePath)}`
      );
      return false;
    }
    return true;
  });

  if (!looseEntries.length && !staleLogs.length) {
    return makeSuccess(
      "tmp-layout",
      ".tmp artifacts are categorized and recent logs are not stale.",
      limitDetails(ignoredActiveArtifacts, (detail) => detail, 10)
    );
  }

  const details = [
    ...limitDetails(
      looseEntries,
      (entry) => entry.detail ?? `Loose .tmp ${entry.kind}: .tmp/${entry.name}`,
      10
    ),
    ...limitDetails(
      staleLogs,
      (filePath) => `Stale log: ${relativePathFrom(rootPath, filePath)}`,
      10
    ),
    ...limitDetails(
      ignoredActiveArtifacts,
      (detail) => `Ignored active temp artifact: ${detail}`,
      5
    ),
  ];

  return makeFailure(
    "tmp-layout",
    ".tmp contains loose artifacts or stale logs.",
    details,
    [
      "Run `npm run tmp:organize` from `source`.",
      "If a log is locked, it is classified as an active temp artifact and a later run can sweep it after the process exits.",
      "Delete stale `.tmp/codex-verify` folders once no Codex verification is running.",
    ]
  );
}

function checkGeneratedRenameFallout(rootPath = projectRoot) {
  const toRelativePath = (filePath) => path.relative(rootPath, filePath).replace(/\\/g, "/");
  const generatedRoot = path.join(
    rootPath,
    "constants",
    "transfer-planner-source"
  );
  const runtimeChunkDir = path.join(generatedRoot, "student-runtime.generated");
  const runtimeWrapperPath = path.join(generatedRoot, "student-runtime.generated.ts");
  const courseWrapperPath = path.join(generatedRoot, "course-metadata.generated.ts");
  const courseDataDir = path.join(generatedRoot, "course-metadata.generated");
  const legacyCourseDataPath = path.join(generatedRoot, "course-metadata.generated.data.json");
  const requirementAdapterWrapperPath = path.join(generatedRoot, "requirement-source-adapters.generated.ts");
  const requirementAdapterDataDir = path.join(generatedRoot, "requirement-source-adapters.generated");

  const expectedRuntimeJsonChunks = [
    "campuses.generated.json",
    "compact-course-registry.generated.json",
    "equivalency-rule-registry.generated.json",
    "gap-registry.generated.json",
    "major-plan-campus-id-by-plan-id.generated.json",
    "major-plan-ids-by-campus.generated.json",
    "tracks.generated.json",
  ];
  const expectedRuntimePartitionDirs = [
    "major-plans-by-plan-id",
    "parsed-requirement-blocks-by-plan-id",
    "pathways-by-plan-id",
    "primary-degree-sources-by-plan-id",
    "resolved-major-plans-by-plan-id",
  ];
  const legacyRuntimeJsonChunks = [
    "major-plans.generated.json",
    "parsed-requirement-block-registry.generated.json",
    "parsed-requirement-source-block-registry.generated.json",
    "pathways-by-plan-id.generated.json",
    "primary-degree-sources-by-key.generated.json",
    "resolved-major-plans-by-key.generated.json",
    "source-gap-registry.generated.json",
  ];

  const issues = [];
  const missingChunks = expectedRuntimeJsonChunks.filter(
    (fileName) => !fileExists(path.join(runtimeChunkDir, fileName))
  );
  for (const fileName of missingChunks) {
    issues.push(`Missing runtime JSON chunk: ${toRelativePath(path.join(runtimeChunkDir, fileName))}`);
  }

  for (const dirName of expectedRuntimePartitionDirs) {
    const dirPath = path.join(runtimeChunkDir, dirName);
    const entries = listDirectory(dirPath);
    if (!statPath(dirPath)?.isDirectory()) {
      issues.push(`Missing runtime JSON partition directory: ${toRelativePath(dirPath)}`);
      continue;
    }
    if (!entries.some((entry) => entry.isFile() && /\.generated\.json$/i.test(entry.name))) {
      issues.push(`Runtime JSON partition directory is empty: ${toRelativePath(dirPath)}`);
    }
  }

  for (const fileName of legacyRuntimeJsonChunks) {
    if (fileExists(path.join(runtimeChunkDir, fileName))) {
      issues.push(`Stale monolithic runtime JSON chunk: ${toRelativePath(path.join(runtimeChunkDir, fileName))}`);
    }
  }

  const staleTsChunks = listDirectory(runtimeChunkDir)
    .filter((entry) => entry.isFile() && /\.generated\.ts$/i.test(entry.name))
    .map((entry) => path.join(runtimeChunkDir, entry.name));
  for (const filePath of staleTsChunks) {
    issues.push(`Stale runtime TS chunk: ${toRelativePath(filePath)}`);
  }

  const legacyRuntimeNames = [
    "major-plans.generated",
    "parsed-requirement-block-registry.generated",
    "parsed-requirement-source-block-registry.generated",
    "pathways-by-plan-id.generated",
    "primary-degree-sources-by-key.generated",
    "resolved-major-plans-by-key.generated",
    "source-gap-registry.generated",
  ];
  const requiredWrapperReferences = [
    "major-plan-ids-by-campus.generated.json",
    "major-plan-campus-id-by-plan-id.generated.json",
    "major-plans-by-plan-id/",
    "parsed-requirement-blocks-by-plan-id/",
    "pathways-by-plan-id/",
    "primary-degree-sources-by-plan-id/",
    "resolved-major-plans-by-plan-id/",
  ];

  if (fileExists(runtimeWrapperPath)) {
    const runtimeWrapper = readText(runtimeWrapperPath);
    if (/student-runtime\.generated\/[^"']+\.generated\.ts/.test(runtimeWrapper)) {
      issues.push("student-runtime.generated.ts still references .generated.ts runtime chunks.");
    }
    if (!runtimeWrapper.includes("createLazyGeneratedValue")) {
      issues.push("student-runtime.generated.ts does not use the lazy generated-value wrapper.");
    }
    if (!runtimeWrapper.includes("createLazyGeneratedRecord")) {
      issues.push("student-runtime.generated.ts does not use the lazy generated-record wrapper for partitioned records.");
    }
    if (/const\s+TRANSFER_PLANNER_RUNTIME_[A-Z0-9_]+_VALUE\s*=\s*require\(/.test(runtimeWrapper)) {
      issues.push("student-runtime.generated.ts still eagerly requires runtime JSON chunks at module load.");
    }
    for (const legacyName of legacyRuntimeNames) {
      if (runtimeWrapper.includes(legacyName)) {
        issues.push(`student-runtime.generated.ts still references ${legacyName}.`);
      }
    }
    for (const requiredReference of requiredWrapperReferences) {
      if (!runtimeWrapper.includes(requiredReference)) {
        issues.push(`student-runtime.generated.ts does not reference ${requiredReference}.`);
      }
    }
  } else {
    issues.push(`Missing runtime wrapper: ${toRelativePath(runtimeWrapperPath)}`);
  }

  if (fileExists(legacyCourseDataPath)) {
    issues.push(`Stale monolithic course metadata JSON: ${toRelativePath(legacyCourseDataPath)}`);
  }

  const coursePartitionDir = path.join(courseDataDir, "entries-by-school-subject");
  if (!statPath(courseDataDir)?.isDirectory()) {
    issues.push(`Missing course metadata JSON directory: ${toRelativePath(courseDataDir)}`);
  }
  if (!fileExists(path.join(courseDataDir, "partition-index.generated.json"))) {
    issues.push(`Missing course metadata partition index: ${toRelativePath(path.join(courseDataDir, "partition-index.generated.json"))}`);
  }
  if (!statPath(coursePartitionDir)?.isDirectory()) {
    issues.push(`Missing course metadata partition directory: ${toRelativePath(coursePartitionDir)}`);
  } else if (!listDirectory(coursePartitionDir).some((entry) => entry.isFile() && /\.generated\.json$/i.test(entry.name))) {
    issues.push(`Course metadata partition directory is empty: ${toRelativePath(coursePartitionDir)}`);
  }

  if (fileExists(courseWrapperPath)) {
    const courseWrapper = readText(courseWrapperPath);
    const lineCount = courseWrapper.split(/\r?\n/).length;
    if (!courseWrapper.includes("course-metadata.generated/entries-by-school-subject/")) {
      issues.push("course-metadata.generated.ts does not reference partitioned metadata JSON files.");
    }
    if (!courseWrapper.includes("partition-index.generated.json")) {
      issues.push("course-metadata.generated.ts does not load the generated metadata partition index.");
    }
    if (!courseWrapper.includes("createLazyGeneratedValue")) {
      issues.push("course-metadata.generated.ts does not use the lazy generated-value wrapper.");
    }
    if (/const\s+TRANSFER_PLANNER_GENERATED_COURSE_METADATA_VALUE\s*=\s*require\(/.test(courseWrapper)) {
      issues.push("course-metadata.generated.ts still eagerly requires course metadata JSON at module load.");
    }
    if (courseWrapper.includes("course-metadata.generated.data.json")) {
      issues.push("course-metadata.generated.ts still references the monolithic metadata JSON file.");
    }
    if (lineCount > 2500) {
      issues.push(
        `course-metadata.generated.ts has ${lineCount.toLocaleString()} lines; expected a small JSON-loading wrapper.`
      );
    }
  } else {
    issues.push(`Missing course metadata wrapper: ${toRelativePath(courseWrapperPath)}`);
  }

  const requirementAdapterBlockDir = path.join(requirementAdapterDataDir, "blocks-by-block-id");
  const staleRequirementAdapterTsChunks = walkFiles(
    requirementAdapterDataDir,
    new Set([".ts"])
  );
  for (const filePath of staleRequirementAdapterTsChunks) {
    issues.push(`Stale requirement-source adapter TS chunk: ${toRelativePath(filePath)}`);
  }
  if (!statPath(requirementAdapterBlockDir)?.isDirectory()) {
    issues.push(`Missing requirement-source adapter block partition directory: ${toRelativePath(requirementAdapterBlockDir)}`);
  } else if (!listDirectory(requirementAdapterBlockDir).some((entry) => entry.isFile() && /\.generated\.json$/i.test(entry.name))) {
    issues.push(`Requirement-source adapter block partition directory is empty: ${toRelativePath(requirementAdapterBlockDir)}`);
  }

  if (fileExists(requirementAdapterWrapperPath)) {
    const requirementAdapterWrapper = readText(requirementAdapterWrapperPath);
    if (!requirementAdapterWrapper.includes("createLazyGeneratedValue")) {
      issues.push("requirement-source-adapters.generated.ts does not use the lazy generated-value wrapper.");
    }
    if (!requirementAdapterWrapper.includes("blocks-by-block-id/")) {
      issues.push("requirement-source-adapters.generated.ts does not reference block-level JSON partitions.");
    }
    if (!requirementAdapterWrapper.includes("getTransferPlannerParsedRequirementBlocksForPlanId")) {
      issues.push("requirement-source-adapters.generated.ts does not expose the plan-id partition accessor.");
    }
    if (/requirement-source-adapters\.generated\/[^"']+\.generated\.ts/.test(requirementAdapterWrapper)) {
      issues.push("requirement-source-adapters.generated.ts still references generated TS chunks.");
    }
    if (/TRANSFER_PLANNER_PARSED_REQUIREMENT_BLOCK_CHUNK_/.test(requirementAdapterWrapper)) {
      issues.push("requirement-source-adapters.generated.ts still references legacy block chunk exports.");
    }
  } else {
    issues.push(`Missing requirement-source adapter wrapper: ${toRelativePath(requirementAdapterWrapperPath)}`);
  }

  if (!issues.length) {
    return makeSuccess(
      "generated-rename-fallout",
      "Generated planner JSON wrappers and chunk filenames look consistent."
    );
  }

  return makeFailure(
    "generated-rename-fallout",
    "Generated planner runtime files look partially renamed or stale.",
    limitDetails(issues, (issue) => issue),
    [
      "Run `npm run planner:build-course-metadata` if course metadata files drifted.",
      "Run `npm run planner:parse-requirement-sources` if requirement-source adapter partitions drifted.",
      "Run `npm run planner:generate-student-runtime` if runtime chunks drifted.",
      "Do not hand-edit generated planner outputs except for an explicit emergency patch.",
    ]
  );
}

function checkEnvTemplates() {
  const generatedEnvTemplatePath = path.join(projectRoot, ".env.example");
  const legacyEnvTemplatePath = path.join(projectRoot, "env.example");
  const issues = [];

  if (!fileExists(generatedEnvTemplatePath)) {
    issues.push("Missing .env.example.");
  } else {
    const template = readText(generatedEnvTemplatePath);
    if (!template.startsWith("# @generated by scripts/dev/generate-env-template.cjs")) {
      issues.push(".env.example is not marked as generated by scripts/dev/generate-env-template.cjs.");
    }
    if (template.includes("EXPO_PUBLIC_USE_STUB_DATA")) {
      issues.push(".env.example still mentions legacy EXPO_PUBLIC_USE_STUB_DATA.");
    }
  }

  if (fileExists(legacyEnvTemplatePath)) {
    issues.push("Legacy duplicate env.example still exists.");
  }

  if (!issues.length) {
    return makeSuccess(
      "env-template",
      "A single generated .env.example template is present."
    );
  }

  return makeFailure(
    "env-template",
    "Client env templates are missing, duplicated, or stale.",
    issues,
    [
      "Run `npm run env:generate` from `source`.",
      "Remove the legacy `source/env.example` file if it reappears.",
    ]
  );
}

function checkLocalStorageContractEnforcement() {
  const allowedDirectImports = new Map([
    [
      "services/storage/local-storage.service.ts",
      "contract-aware AsyncStorage adapter",
    ],
    [
      "services/firebase/firebase.ts",
      "Firebase auth persistence requires the native storage object",
    ],
  ]);
  const importPattern =
    /(?:import\s+[\s\S]*?\s+from\s+["']@react-native-async-storage\/async-storage["']|require\(\s*["']@react-native-async-storage\/async-storage["']\s*\))/;
  const scanRoots = ["app", "components", "hooks", "services", "scripts"]
    .map((root) => path.join(projectRoot, root))
    .filter(fileExists);
  const scanExtensions = new Set([".cjs", ".js", ".mjs", ".ts", ".tsx"]);
  const directImports = [];

  for (const scanRoot of scanRoots) {
    for (const filePath of walkFiles(scanRoot, scanExtensions, [], {
      skipDirectoryNames: new Set(["node_modules"]),
    })) {
      const relative = relativePath(filePath);
      if (allowedDirectImports.has(relative)) continue;

      if (importPattern.test(readText(filePath))) {
        directImports.push(relative);
      }
    }
  }

  if (!directImports.length) {
    return makeSuccess(
      "local-storage-contracts",
      "App storage access is routed through the local storage contract adapter."
    );
  }

  return makeFailure(
    "local-storage-contracts",
    "Some modules import AsyncStorage directly and bypass local storage contracts.",
    limitDetails(directImports, (filePath) => `Direct AsyncStorage import: ${filePath}`),
    [
      "Use `localStorageService` from `services/storage/local-storage.service.ts` for app-owned keys.",
      "Add new keys to `LOCAL_STORAGE_CONTRACTS` before persisting them.",
      "Only allow direct imports for APIs that need the native AsyncStorage object, such as Firebase auth persistence.",
    ]
  );
}

function checkMetroConfigLoad() {
  const metroConfigPath = path.join(projectRoot, "metro.config.js");
  const previousCwd = process.cwd();

  try {
    process.chdir(projectRoot);
    delete require.cache[require.resolve(metroConfigPath)];
    require(metroConfigPath);
    return makeSuccess(
      "metro-config-load",
      "Metro config loads from the project root."
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const details = [message];
    const fix = [];

    if (/tailwind\.config/i.test(message)) {
      fix.push("Make sure `tailwind.config.js` exists at the source project root.");
    }

    if (/@\/services\//.test(message) || /@babel\/core/.test(message)) {
      fix.push("Run `npm run health:repo` to confirm whether @babel/core is corrupted.");
    }

    fix.push("Re-run `npm install` if Metro config dependencies are missing.");

    return makeFailure(
      "metro-config-load",
      "Metro config could not be loaded from the project root.",
      details,
      fix
    );
  } finally {
    process.chdir(previousCwd);
  }
}

function runRepoHealthCheck() {
  const checks = [
    checkRequiredFiles(),
    checkRootScratchFiles(),
    checkTsConfigGeneratedExclusions(),
    checkTmpLayout(),
    checkGeneratedRenameFallout(),
    checkEnvTemplates(),
    checkLocalStorageContractEnforcement(),
    checkBabelCoreInstall(),
    checkMetroConfigLoad(),
  ];

  return {
    ok: checks.every((check) => check.ok),
    checks,
  };
}

function printRepoHealthCheck(result) {
  const prefix = result.ok ? "[repo-health] PASS" : "[repo-health] FAIL";
  process.stdout.write(`${prefix}\n`);

  for (const check of result.checks) {
    const checkPrefix = check.ok ? "  [ok]" : "  [x]";
    process.stdout.write(`${checkPrefix} ${check.message}\n`);

    for (const detail of check.details || []) {
      process.stdout.write(`      - ${detail}\n`);
    }

    if (!check.ok && check.fix?.length) {
      process.stdout.write("      Fix:\n");
      for (const step of check.fix) {
        process.stdout.write(`      - ${step}\n`);
      }
    }
  }
}

module.exports = {
  runRepoHealthCheck,
  printRepoHealthCheck,
  checkEnvTemplates,
  checkGeneratedRenameFallout,
  checkLocalStorageContractEnforcement,
  checkRootScratchFiles,
  checkTsConfigGeneratedExclusions,
  checkTmpLayout,
};

if (require.main === module) {
  const result = runRepoHealthCheck();
  printRepoHealthCheck(result);
  process.exit(result.ok ? 0 : 1);
}
