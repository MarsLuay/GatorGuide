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

function runStep(label, callback) {
  console.log("");
  console.log(`== ${label} ==`);
  callback();
}

function runAsyncStep(label, callback) {
  console.log("");
  console.log(`== ${label} ==`);
  return callback();
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

function runVerification() {
  runStep("Audit transfer planner owners", () =>
    runCommand("node", ["scripts/planner/verify-transfer-planner-owner-audit.cjs"])
  );
  runStep("Run TypeScript typecheck", () => runCommand(NPX_BIN, ["tsc", "--noEmit"]));
  runStep("Run transfer planner tests", () =>
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
  fs.mkdirSync(TMP_DIR, { recursive: true });

  for (const download of scheduleDownloads) {
    if (!forceRefresh && fs.existsSync(download.outputPath)) {
      console.log(`Keeping existing ${download.label}: ${download.outputPath}`);
      continue;
    }

    console.log(`Downloading ${download.label}...`);
    try {
      await downloadFileWithRetry(download.url, download.outputPath);
      console.log(`Saved ${download.outputPath}`);
    } catch (error) {
      if (fs.existsSync(download.outputPath)) {
        console.log(
          `Download failed for ${download.label}; keeping existing cached file ${download.outputPath}.`
        );
        console.log(`Download error: ${error.message}`);
        continue;
      }
      throw error;
    }
  }
}

async function main() {
  const verifyOnly = hasArg("--verify-only");
  const skipSourceCheck = hasArg("--skip-source-check");
  const skipPrimaryPromotion = hasArg("--skip-primary-promotion");
  const skipRequirementParse = hasArg("--skip-requirement-parse");
  const skipRequirementPromotion = hasArg("--skip-requirement-promotion");
  const skipDownloads = hasArg("--skip-downloads");
  const skipVerify = hasArg("--skip-verify");
  const forceRefreshDownloads = hasArg("--refresh-downloads");

  console.log("Starting transfer planner refresh pipeline...");

  if (verifyOnly) {
    runVerification();
    console.log("Transfer planner verification complete.");
    return;
  }

  const grcPublicMaterials = await runAsyncStep("Discover Green River public materials", () =>
    loadGrcPublicMaterials({
      forceRefresh: true,
      allowSnapshotFallback: true,
    })
  );
  runStep("Check source year coverage", () =>
    runCommand("node", ["scripts/planner/check-transfer-planner-source-year-coverage.cjs"])
  );
  runStep("Generate Green River associate tracks", () =>
    runCommand("node", ["scripts/planner/generate-transfer-planner-grc-associate-tracks.cjs"])
  );
  const scheduleDownloads = grcPublicMaterials.annualSchedules.map((entry) => ({
    label: `Green River annual schedule ${entry.label}`,
    url: entry.url,
    outputPath: entry.outputPath,
  }));

  if (!skipSourceCheck) {
    runStep("Check official source links", () =>
      runCommand("node", ["scripts/planner/check-transfer-planner-sources.cjs"])
    );
  }

  if (!skipPrimaryPromotion) {
    runStep("Discover and promote primary official sources", () =>
      runCommand("node", [
        "scripts/planner/promote-transfer-planner-primary-sources.cjs",
        "--discover-first",
      ])
    );
    runStep("Build primary-source automation queue", () =>
      runCommand("node", ["scripts/planner/build-transfer-planner-primary-source-review-queue.cjs"])
    );
    runStep("Classify hidden source gaps", () =>
      runCommand("node", ["scripts/planner/build-transfer-planner-source-gap-report.cjs"])
    );
  }

  if (!skipRequirementParse) {
    runStep("Parse UW major requirement sources", () =>
      runCommand("node", ["scripts/planner/parse-transfer-planner-requirement-sources.cjs"])
    );
  }

  if (!skipRequirementPromotion) {
    runStep("Promote source-backed requirement diffs", () =>
      runCommand("node", ["scripts/planner/promote-transfer-planner-requirement-diffs.cjs"])
    );
  }

  runStep("Build source and parsed-fact fingerprints", () =>
    runCommand("node", ["scripts/planner/build-transfer-planner-source-fingerprints.cjs"])
  );

  if (!skipDownloads) {
    await runAsyncStep("Snapshot Green River annual schedules", () =>
      refreshScheduleDownloads(scheduleDownloads, forceRefreshDownloads)
    );
  }

  runStep("Generate source bootstrap", () =>
    runCommand("node", ["scripts/planner/generate-transfer-planner-source-bootstrap.cjs"])
  );
  runStep("Parse UW Green River equivalency guide", () =>
    runCommand("node", ["scripts/planner/parse-transfer-planner-equivalency-guide.cjs"])
  );
  runStep("Ingest Green River course catalog", () =>
    runCommand("node", ["scripts/planner/ingest-grc-catalog.cjs"])
  );
  runStep("Ingest UW course catalogs", () =>
    runCommand("node", ["scripts/planner/ingest-uw-catalog.cjs"])
  );
  runStep("Generate merged course metadata", () =>
    runCommand("node", ["scripts/planner/generate-transfer-planner-course-metadata.cjs"])
  );
  runStep("Generate Green River availability registry", () =>
    runCommand("node", ["scripts/planner/generate-transfer-planner-grc-availability.cjs"])
  );
  runStep("Generate planner docs", () =>
    runTsNode("scripts/planner/generate-transfer-planner-docs.ts")
  );

  if (!skipVerify) {
    runVerification();
  }

  console.log("Transfer planner refresh pipeline complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
