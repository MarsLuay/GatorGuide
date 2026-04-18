/* global __dirname, Buffer */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { loadGrcPublicMaterials } = require("./grc-public-materials.cjs");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const TMP_DIR = path.resolve(REPO_ROOT, ".tmp");
const TS_NODE_COMPILER_OPTIONS = JSON.stringify({ module: "CommonJS" });
const NPX_BIN = process.platform === "win32" ? "npx.cmd" : "npx";
function hasArg(flag) {
  return process.argv.slice(2).includes(flag);
}

function getArgValue(flag) {
  const args = process.argv.slice(2);
  const directPrefix = `${flag}=`;
  const directMatch = args.find((arg) => arg.startsWith(directPrefix));
  if (directMatch) {
    return directMatch.slice(directPrefix.length).trim() || null;
  }

  const flagIndex = args.indexOf(flag);
  if (flagIndex === -1) {
    return null;
  }

  const nextValue = args[flagIndex + 1];
  if (!nextValue || nextValue.startsWith("--")) {
    return null;
  }

  return String(nextValue).trim() || null;
}

const REFRESH_SECTION_DEFINITIONS = [
  {
    id: "grc-discovery",
    title: "Refresh: GRC discovery and baseline",
    description:
      "Discover Green River public materials, verify source-year coverage, and regenerate Green River associate tracks.",
    steps: [
      { label: "Discover Green River public materials" },
      { label: "Check source year coverage" },
      { label: "Generate Green River associate tracks" },
    ],
  },
  {
    id: "source-audit",
    title: "Refresh: source audit and gap detection",
    description:
      "Check official source links, discover primary sources, build the source queue, and classify hidden source gaps.",
    steps: [
      {
        label: "Check official source links",
        include: (options) => !options.skipSourceCheck,
      },
      { label: "Discover primary official sources" },
      { label: "Build primary-source automation queue" },
      { label: "Classify hidden source gaps" },
    ],
  },
  {
    id: "requirement-parsing",
    title: "Refresh: requirement parsing and fingerprints",
    description:
      "Parse UW major requirement sources, rebuild source and parsed-fact fingerprints, and validate canonical source-pipeline invariants.",
    steps: [
      {
        label: "Parse UW major requirement sources",
        include: (options) => !options.skipRequirementParse,
      },
      { label: "Build source and parsed-fact fingerprints" },
      { label: "Validate source pipeline invariants" },
    ],
  },
  {
    id: "schedule-cache",
    title: "Refresh: annual schedule cache",
    description:
      "Download or reuse the current Green River annual schedule PDFs used by the planner.",
    steps: [
      {
        label: "Snapshot Green River annual schedules",
        include: (options) => !options.skipDownloads,
      },
    ],
  },
  {
    id: "catalog-and-generation",
    title: "Refresh: catalog ingest and generated outputs",
    description:
      "Generate the source bootstrap, parse equivalencies, ingest catalogs, merge metadata, rebuild availability, and refresh docs.",
    steps: [
      { label: "Generate source bootstrap" },
      { label: "Parse UW Green River equivalency guide" },
      { label: "Ingest Green River course catalog" },
      { label: "Ingest UW course catalogs" },
      { label: "Generate merged course metadata" },
      { label: "Generate Green River availability registry" },
      { label: "Generate planner docs" },
    ],
  },
  {
    id: "verification",
    title: "Refresh: verification suite",
    description:
      "Run the owner audit, TypeScript typecheck, and planner tests after the refresh finishes.",
    steps: [
      {
        label: "Validate source pipeline invariants",
        include: (options) => options.verifyOnly,
      },
      {
        label: "Refresh requirement-diff classification report",
        include: (options) => !options.skipVerify || options.verifyOnly,
      },
      {
        label: "Audit transfer planner owners",
        include: (options) => !options.skipVerify || options.verifyOnly,
      },
      {
        label: "Run TypeScript typecheck",
        include: (options) => !options.skipVerify || options.verifyOnly,
      },
      {
        label: "Run transfer planner tests",
        include: (options) => !options.skipVerify || options.verifyOnly,
      },
    ],
  },
];

function formatDuration(milliseconds) {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

function summarizeList(values, limit = 8) {
  if (!values.length) {
    return "none";
  }
  return values.slice(0, limit).join(", ");
}

function printRefreshSummary(summary) {
  const executedStepLabels = summary.steps.map((step) => step.label);
  const skippedStepLabels = summary.skippedSteps.map((step) => step.label);

  console.log("");
  console.log("Refresh summary:");
  console.log(`- Mode: ${summary.mode}`);
  console.log(`- Steps executed: ${summary.steps.length}; skipped: ${summary.skippedSteps.length}`);
  console.log(
    `- Schedule downloads: downloaded ${summary.downloads.downloaded}; reused ${summary.downloads.reused}; fallback-used ${summary.downloads.fallbackUsed}`
  );
  console.log(`- Duration: ${formatDuration(summary.finishedAt - summary.startedAt)}`);
  console.log(`  Executed steps (sample): ${summarizeList(executedStepLabels)}`);
  console.log(`  Skipped steps (sample): ${summarizeList(skippedStepLabels)}`);
}

function runStep(label, callback) {
  console.log("");
  console.log(`== ${label} ==`);
  const startedAt = Date.now();
  callback();
  console.log(`Completed in ${formatDuration(Date.now() - startedAt)}.`);
}

function runAsyncStep(label, callback) {
  console.log("");
  console.log(`== ${label} ==`);
  const startedAt = Date.now();
  return Promise.resolve(callback()).then((result) => {
    console.log(`Completed in ${formatDuration(Date.now() - startedAt)}.`);
    return result;
  });
}

function getRefreshSectionDefinition(sectionId) {
  return REFRESH_SECTION_DEFINITIONS.find((section) => section.id === sectionId) ?? null;
}

function resolveSelectedRefreshSections(options) {
  if (options.verifyOnly) {
    return REFRESH_SECTION_DEFINITIONS.filter((section) => section.id === "verification");
  }

  if (options.onlySection) {
    const onlySection = getRefreshSectionDefinition(options.onlySection);
    if (!onlySection) {
      throw new Error(
        `Unknown refresh section "${options.onlySection}". Valid sections: ${REFRESH_SECTION_DEFINITIONS.map(
          (section) => section.id
        ).join(", ")}`
      );
    }
    return [onlySection];
  }

  if (options.startSection) {
    const startIndex = REFRESH_SECTION_DEFINITIONS.findIndex(
      (section) => section.id === options.startSection
    );
    if (startIndex === -1) {
      throw new Error(
        `Unknown refresh start section "${options.startSection}". Valid sections: ${REFRESH_SECTION_DEFINITIONS.map(
          (section) => section.id
        ).join(", ")}`
      );
    }
    return REFRESH_SECTION_DEFINITIONS.slice(startIndex);
  }

  return REFRESH_SECTION_DEFINITIONS;
}

function buildRefreshSectionPlan(options) {
  const selectedSections = resolveSelectedRefreshSections(options);
  return selectedSections
    .map((section) => ({
      id: section.id,
      title: section.title,
      description: section.description,
      steps: section.steps
        .filter((step) => !step.include || step.include(options))
        .map((step) => ({
          label: step.label,
        })),
    }))
    .filter((section) => section.steps.length > 0);
}

function buildPlannedStepLabels(options) {
  return buildRefreshSectionPlan(options).flatMap((section) =>
    section.steps.map((step) => step.label)
  );
}

function buildStepPlanFromArgs() {
  const verifyOnly = hasArg("--verify-only");
  const skipSourceCheck = hasArg("--skip-source-check");
  const skipRequirementParse = hasArg("--skip-requirement-parse");
  const skipDownloads = hasArg("--skip-downloads");
  const skipVerify = hasArg("--skip-verify");
  const forceRefreshDownloads = hasArg("--refresh-downloads");
  const onlySection = getArgValue("--only-section");
  const startSection = getArgValue("--start-section");
  if (onlySection && startSection) {
    throw new Error("Use either --only-section or --start-section, not both.");
  }

  const options = {
    verifyOnly,
    skipSourceCheck,
    skipRequirementParse,
    skipDownloads,
    skipVerify,
    forceRefreshDownloads,
    onlySection,
    startSection,
  };
  const sectionPlan = buildRefreshSectionPlan(options);
  const plannedStepLabels = sectionPlan.flatMap((section) =>
    section.steps.map((step) => step.label)
  );

  return {
    ...options,
    sectionPlan,
    plannedStepLabels,
  };
}

function runCommand(command, args, options = {}) {
  const isWindowsCmd = process.platform === "win32" && /\.cmd$/i.test(command);
  const result = spawnSync(isWindowsCmd ? "cmd" : command, isWindowsCmd ? ["/c", command, ...args] : args, {
    cwd: REPO_ROOT,
    stdio: "inherit",
    shell: false,
    env: {
      ...process.env,
      ...(options.env ?? {}),
    },
  });

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
}

function runTsNode(scriptPath) {
  runCommand(
    NPX_BIN,
    [
      "ts-node",
      "--project",
      "tsconfig.json",
      "--require",
      "tsconfig-paths/register",
      scriptPath,
    ],
    {
      env: {
        TS_NODE_COMPILER_OPTIONS,
        TS_NODE_BASEURL: ".",
      },
    }
  );
}

function sleep(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function runVerification(runStepFn = runStep, options = {}) {
  if (options.includePipelineValidation) {
    runStepFn("Validate source pipeline invariants", () =>
      runCommand("node", ["scripts/planner/verify-transfer-planner-source-pipeline.cjs"])
    );
  }
  runStepFn("Refresh requirement-diff classification report", () =>
    runCommand("node", ["scripts/planner/build-transfer-planner-requirement-diff-report.cjs"])
  );
  runStepFn("Audit transfer planner owners", () =>
    runCommand("node", ["scripts/planner/verify-transfer-planner-owner-audit.cjs"])
  );
  runStepFn("Run TypeScript typecheck", () => runCommand(NPX_BIN, ["tsc", "--noEmit"]));
  runStepFn("Run transfer planner tests", () =>
    runTsNode("scripts/planner/transfer-planner.service.test.ts")
  );
}

async function downloadFile(url, outputPath) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent": "GatorGuideTransferPlannerRefresh/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, buffer);
}

async function downloadFileWithRetry(url, outputPath, attempts = 3) {
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await downloadFile(url, outputPath);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await sleep(800 * attempt);
      }
    }
  }

  throw lastError;
}

async function refreshScheduleDownloads(scheduleDownloads, forceRefresh) {
  const stats = {
    downloaded: 0,
    reused: 0,
    fallbackUsed: 0,
  };

  fs.mkdirSync(TMP_DIR, { recursive: true });

  for (const download of scheduleDownloads) {
    if (!forceRefresh && fs.existsSync(download.outputPath)) {
      console.log(`Keeping existing ${download.label}: ${download.outputPath}`);
      stats.reused += 1;
      continue;
    }

    console.log(`Downloading ${download.label}...`);
    try {
      await downloadFileWithRetry(download.url, download.outputPath);
      console.log(`Saved ${download.outputPath}`);
      stats.downloaded += 1;
    } catch (error) {
      if (fs.existsSync(download.outputPath)) {
        console.log(
          `Download failed for ${download.label}; keeping existing cached file ${download.outputPath}.`
        );
        console.log(`Download error: ${error.message}`);
        stats.fallbackUsed += 1;
        continue;
      }
      throw error;
    }
  }

  return stats;
}

async function main() {
  const {
    verifyOnly,
    skipSourceCheck,
    skipRequirementParse,
    skipDownloads,
    skipVerify,
    forceRefreshDownloads,
    onlySection,
    startSection,
    sectionPlan,
    plannedStepLabels,
  } = buildStepPlanFromArgs();

  if (hasArg("--print-step-plan-json")) {
    console.log(
      JSON.stringify({
        mode: verifyOnly ? "verify-only" : "full-refresh",
        count: plannedStepLabels.length,
        labels: plannedStepLabels,
        selectedSectionIds: sectionPlan.map((section) => section.id),
        sections: sectionPlan.map((section) => ({
          id: section.id,
          title: section.title,
          description: section.description,
          count: section.steps.length,
          labels: section.steps.map((step) => step.label),
        })),
        availableSections: REFRESH_SECTION_DEFINITIONS.map((section) => ({
          id: section.id,
          title: section.title,
          description: section.description,
        })),
        flags: {
          verifyOnly,
          skipSourceCheck,
          skipRequirementParse,
          skipDownloads,
          skipVerify,
          forceRefreshDownloads,
          onlySection,
          startSection,
        },
      })
    );
    return;
  }

  if (!plannedStepLabels.length) {
    throw new Error(
      "The selected refresh section plan has no runnable steps. Adjust the section/skip flags and try again."
    );
  }

  const summary = {
    mode: verifyOnly ? "verify-only" : "full-refresh",
    startedAt: Date.now(),
    finishedAt: Date.now(),
    steps: [],
    skippedSteps: [],
    downloads: {
      downloaded: 0,
      reused: 0,
      fallbackUsed: 0,
    },
  };

  let nextTrackedStepIndex = 0;
  const refreshContext = {
    grcPublicMaterials: null,
  };

  const formatTrackedLabel = (label) => {
    nextTrackedStepIndex += 1;
    return `[${nextTrackedStepIndex}/${plannedStepLabels.length}] ${label}`;
  };

  const runTrackedStep = (label, callback) => {
    runStep(formatTrackedLabel(label), callback);
    summary.steps.push({ label });
  };

  const runTrackedAsyncStep = async (label, callback) => {
    const result = await runAsyncStep(formatTrackedLabel(label), callback);
    summary.steps.push({ label });
    return result;
  };

  const markSkipped = (label, reason) => {
    summary.skippedSteps.push({ label, reason });
    console.log(`Skipping ${label} (${reason}).`);
  };

  const getGrcPublicMaterials = async () => {
    if (!refreshContext.grcPublicMaterials) {
      refreshContext.grcPublicMaterials = await loadGrcPublicMaterials({
        forceRefresh: true,
        allowSnapshotFallback: true,
      });
    }
    return refreshContext.grcPublicMaterials;
  };

  const runSelectedSection = async (sectionId) => {
    switch (sectionId) {
      case "grc-discovery": {
        await runTrackedAsyncStep("Discover Green River public materials", () =>
          getGrcPublicMaterials()
        );
        runTrackedStep("Check source year coverage", () =>
          runCommand("node", ["scripts/planner/check-transfer-planner-source-year-coverage.cjs"])
        );
        runTrackedStep("Generate Green River associate tracks", () =>
          runCommand("node", ["scripts/planner/generate-transfer-planner-grc-associate-tracks.cjs"])
        );
        return;
      }
      case "source-audit": {
        if (!skipSourceCheck) {
          runTrackedStep("Check official source links", () =>
            runCommand("node", ["scripts/planner/check-transfer-planner-sources.cjs"])
          );
        } else {
          markSkipped("Check official source links", "--skip-source-check");
        }

        runTrackedStep("Discover primary official sources", () =>
          runCommand("node", ["scripts/planner/discover-transfer-planner-primary-sources.cjs"])
        );
        runTrackedStep("Build primary-source automation queue", () =>
          runCommand("node", ["scripts/planner/build-transfer-planner-primary-source-review-queue.cjs"])
        );
        runTrackedStep("Promote high-confidence primary sources", () =>
          runCommand("node", ["scripts/planner/build-transfer-planner-primary-source-promotions.cjs"])
        );
        runTrackedStep("Classify hidden source gaps", () =>
          runCommand("node", ["scripts/planner/build-transfer-planner-source-gap-report.cjs"])
        );
        return;
      }
      case "requirement-parsing": {
        if (!skipRequirementParse) {
          runTrackedStep("Parse UW major requirement sources", () =>
            runCommand("node", ["scripts/planner/parse-transfer-planner-requirement-sources.cjs"])
          );
        } else {
          markSkipped("Parse UW major requirement sources", "--skip-requirement-parse");
        }

        runTrackedStep("Build source and parsed-fact fingerprints", () =>
          runCommand("node", ["scripts/planner/build-transfer-planner-source-fingerprints.cjs"])
        );
        runTrackedStep("Validate source pipeline invariants", () =>
          runCommand("node", ["scripts/planner/verify-transfer-planner-source-pipeline.cjs"])
        );
        return;
      }
      case "schedule-cache": {
        if (!skipDownloads) {
          const grcPublicMaterials = await getGrcPublicMaterials();
          const scheduleDownloads = grcPublicMaterials.annualSchedules.map((entry) => ({
            label: `Green River annual schedule ${entry.label}`,
            url: entry.url,
            outputPath: entry.outputPath,
          }));
          summary.downloads = await runTrackedAsyncStep("Snapshot Green River annual schedules", () =>
            refreshScheduleDownloads(scheduleDownloads, forceRefreshDownloads)
          );
        } else {
          markSkipped("Snapshot Green River annual schedules", "--skip-downloads");
        }
        return;
      }
      case "catalog-and-generation": {
        runTrackedStep("Generate source bootstrap", () =>
          runCommand("node", ["scripts/planner/generate-transfer-planner-source-bootstrap.cjs"])
        );
        runTrackedStep("Parse UW Green River equivalency guide", () =>
          runCommand("node", ["scripts/planner/parse-transfer-planner-equivalency-guide.cjs"])
        );
        runTrackedStep("Ingest Green River course catalog", () =>
          runCommand("node", ["scripts/planner/ingest-grc-catalog.cjs"])
        );
        runTrackedStep("Ingest UW course catalogs", () =>
          runCommand("node", ["scripts/planner/ingest-uw-catalog.cjs"])
        );
        runTrackedStep("Generate merged course metadata", () =>
          runCommand("node", ["scripts/planner/generate-transfer-planner-course-metadata.cjs"])
        );
        runTrackedStep("Generate Green River availability registry", () =>
          runCommand("node", ["scripts/planner/generate-transfer-planner-grc-availability.cjs"])
        );
        runTrackedStep("Generate planner docs", () =>
          runTsNode("scripts/planner/generate-transfer-planner-docs.ts")
        );
        return;
      }
      case "verification": {
        if (!skipVerify || verifyOnly) {
          runVerification(runTrackedStep, { includePipelineValidation: verifyOnly });
        } else {
          markSkipped("Refresh verification suite", "--skip-verify");
        }
        return;
      }
      default:
        throw new Error(`Unsupported refresh section "${sectionId}".`);
    }
  };

  console.log("Starting transfer planner refresh pipeline...");
  console.log(`Planned tracked steps: ${plannedStepLabels.length}.`);
  console.log(
    `Selected refresh sections: ${sectionPlan.map((section) => section.id).join(", ")}.`
  );

  for (const section of sectionPlan) {
    await runSelectedSection(section.id);
  }

  summary.finishedAt = Date.now();
  printRefreshSummary(summary);
  console.log("Transfer planner refresh pipeline complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
