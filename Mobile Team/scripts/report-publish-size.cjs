#!/usr/bin/env node

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const BYTES_PER_MB = 1024 * 1024;

function log(message) {
  process.stdout.write(`[publish-size] ${message}\n`);
}

function fail(message, details) {
  process.stderr.write(`[publish-size] ${message}\n`);
  if (details) {
    process.stderr.write(`${details}\n`);
  }
  process.exit(1);
}

function getExpoCliPath() {
  const localExpoCli = path.join(process.cwd(), "node_modules", "expo", "bin", "cli");
  if (!fs.existsSync(localExpoCli)) {
    fail(
      "Expo CLI was not found in node_modules. Run npm install in Mobile Team first."
    );
  }
  return localExpoCli;
}

function formatMb(bytes) {
  return `${(bytes / BYTES_PER_MB).toFixed(2)} MB`;
}

function collectFiles(rootDir) {
  const files = [];
  const stack = [rootDir];

  while (stack.length) {
    const currentDir = stack.pop();
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolutePath);
        continue;
      }
      if (entry.isFile()) {
        files.push(absolutePath);
      }
    }
  }

  return files;
}

function calculateExportSize(exportDir) {
  const files = collectFiles(exportDir);
  const publishFiles = [];
  const debugFiles = [];
  const skippedFiles = [];
  let publishBytes = 0;
  let debugBytes = 0;

  for (const filePath of files) {
    const stats = fs.statSync(filePath);
    const relativePath = path.relative(exportDir, filePath);
    const record = {
      path: relativePath,
      bytes: stats.size,
    };

    if (filePath.endsWith(".map")) {
      debugFiles.push(record);
      debugBytes += stats.size;
      continue;
    }

    const normalizedPath = relativePath.replace(/\\/g, "/");
    const isFlatNativeAsset =
      normalizedPath.startsWith("assets/") &&
      !normalizedPath.slice("assets/".length).includes("/");
    const isNativePublishFile =
      normalizedPath === "metadata.json" ||
      isFlatNativeAsset ||
      normalizedPath.startsWith("_expo/static/js/android/") ||
      normalizedPath.startsWith("_expo/static/js/ios/");

    if (!isNativePublishFile) {
      skippedFiles.push(record);
      continue;
    }

    publishFiles.push(record);
    publishBytes += stats.size;
  }

  publishFiles.sort((left, right) => right.bytes - left.bytes);
  debugFiles.sort((left, right) => right.bytes - left.bytes);
  skippedFiles.sort((left, right) => right.bytes - left.bytes);

  return {
    publishBytes,
    debugBytes,
    publishFiles,
    debugFiles,
    skippedFiles,
    totalFileCount: files.length,
  };
}

function runExpoExport(expoCliPath, outputDir) {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      CI: "1",
      EXPO_NO_TELEMETRY: "1",
    };

    const child = spawn(
      process.execPath,
      [
        expoCliPath,
        "export",
        "--platform",
        "all",
        "--output-dir",
        outputDir,
      ],
      {
        cwd: process.cwd(),
        env,
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.once("error", (error) => reject(error));
    child.once("exit", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(
        new Error(
          [
            `Expo export failed with exit code ${code}.`,
            stdout.trim(),
            stderr.trim(),
          ]
            .filter(Boolean)
            .join("\n\n")
        )
      );
    });
  });
}

async function main() {
  const expoCliPath = getExpoCliPath();
  const tempExportDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "gatorguide-publish-size-")
  );

  try {
    log("Generating a fresh export to estimate the native publish payload...");
    await runExpoExport(expoCliPath, tempExportDir);

    const result = calculateExportSize(tempExportDir);
    const largestFiles = result.publishFiles.slice(0, 5);

    log(`Current publish size estimate: ${formatMb(result.publishBytes)}`);
    log(
      `Counted ${result.publishFiles.length} native publish files from the current Expo export.`
    );

    if (result.debugBytes > 0) {
      log(
        `Ignored ${result.debugFiles.length} source map files (${formatMb(
          result.debugBytes
        )}) so the estimate reflects shipped app content.`
      );
    }

    if (result.skippedFiles.length > 0) {
      log(
        `Skipped ${result.skippedFiles.length} web/static route files so this stays focused on the iOS + Android publish payload.`
      );
    }

    if (largestFiles.length) {
      log("Largest publish files:");
      for (const file of largestFiles) {
        log(`- ${file.path}: ${formatMb(file.bytes)}`);
      }
    }
  } finally {
    fs.rmSync(tempExportDir, { recursive: true, force: true });
  }
}

void main().catch((error) => {
  fail(
    "Could not calculate the current publish size.",
    error instanceof Error ? error.message : String(error)
  );
});
