const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const TMP_DIR = path.resolve(REPO_ROOT, ".tmp");
const TS_NODE_COMPILER_OPTIONS = JSON.stringify({ module: "CommonJS" });
const NPX_BIN = process.platform === "win32" ? "npx.cmd" : "npx";
const SCHEDULE_DOWNLOADS = [
  {
    label: "Green River annual schedule 2024-2025",
    url: "https://www.greenriver.edu/students/media/documents/schedules-and-catalog/2024-2025-Annual-Schedule.pdf",
    outputPath: path.resolve(TMP_DIR, "2024-2025-Annual-Schedule.pdf"),
  },
  {
    label: "Green River annual schedule 2025-2026",
    url: "https://www.greenriver.edu/students/media/documents/schedules-and-catalog/2025-2026%20Annual%20Schedule%20w%20Cover.pdf",
    outputPath: path.resolve(TMP_DIR, "2025-2026-Annual-Schedule.pdf"),
  },
];

function hasArg(flag) {
  return process.argv.slice(2).includes(flag);
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

async function refreshScheduleDownloads(forceRefresh) {
  fs.mkdirSync(TMP_DIR, { recursive: true });

  for (const download of SCHEDULE_DOWNLOADS) {
    if (!forceRefresh && fs.existsSync(download.outputPath)) {
      console.log(`Keeping existing ${download.label}: ${download.outputPath}`);
      continue;
    }

    console.log(`Downloading ${download.label}...`);
    await downloadFile(download.url, download.outputPath);
    console.log(`Saved ${download.outputPath}`);
  }
}

async function main() {
  const skipSourceCheck = hasArg("--skip-source-check");
  const skipPrimaryPromotion = hasArg("--skip-primary-promotion");
  const skipRequirementParse = hasArg("--skip-requirement-parse");
  const skipRequirementPromotion = hasArg("--skip-requirement-promotion");
  const skipDownloads = hasArg("--skip-downloads");
  const skipVerify = hasArg("--skip-verify");
  const forceRefreshDownloads = hasArg("--refresh-downloads");

  console.log("Starting transfer planner refresh pipeline...");

  if (!skipSourceCheck) {
    runCommand("node", ["scripts/planner/check-transfer-planner-sources.cjs"]);
  }

  if (!skipPrimaryPromotion) {
    runCommand("node", [
      "scripts/planner/promote-transfer-planner-primary-sources.cjs",
      "--discover-first",
    ]);
    runCommand("node", ["scripts/planner/build-transfer-planner-primary-source-review-queue.cjs"]);
  }

  if (!skipRequirementParse) {
    runCommand("node", ["scripts/planner/parse-transfer-planner-requirement-sources.cjs"]);
  }

  if (!skipRequirementPromotion) {
    runCommand("node", ["scripts/planner/promote-transfer-planner-requirement-diffs.cjs"]);
  }

  if (!skipDownloads) {
    await refreshScheduleDownloads(forceRefreshDownloads);
  }

  runCommand("node", ["scripts/planner/generate-transfer-planner-source-bootstrap.cjs"]);
  runCommand("node", ["scripts/planner/generate-transfer-planner-course-metadata.cjs"]);
  runCommand("node", ["scripts/planner/generate-transfer-planner-grc-availability.cjs"]);
  runCommand(
    NPX_BIN,
    [
      "ts-node",
      "--project",
      "tsconfig.json",
      "--require",
      "tsconfig-paths/register",
      "scripts/planner/generate-transfer-planner-docs.ts",
    ],
    {
      env: {
        TS_NODE_COMPILER_OPTIONS,
      },
    }
  );

  if (!skipVerify) {
    runCommand(NPX_BIN, ["tsc", "--noEmit"]);
    runCommand(
      NPX_BIN,
      [
        "ts-node",
        "--project",
        "tsconfig.json",
        "--require",
        "tsconfig-paths/register",
        "scripts/planner/transfer-planner.service.test.ts",
      ],
      {
        env: {
          TS_NODE_COMPILER_OPTIONS,
        },
      }
    );
  }

  console.log("Transfer planner refresh pipeline complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
