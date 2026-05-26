#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..", "..");
const sourcePath = path.join(projectRoot, "services", "network", "fetch-contract.cjs");
const functionsPath = path.join(projectRoot, "functions", "fetch-contract.cjs");

function readFile(filePath) {
  return fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
}

function isFetchContractInSync() {
  return readFile(sourcePath) === readFile(functionsPath);
}

function syncFetchContract() {
  fs.copyFileSync(sourcePath, functionsPath);
}

function main() {
  const checkOnly = process.argv.includes("--check");

  if (checkOnly) {
    if (!isFetchContractInSync()) {
      process.stderr.write(
        "functions/fetch-contract.cjs is stale. Run node scripts/lib/sync-fetch-contract.cjs.\n"
      );
      process.exit(1);
    }
    process.stdout.write("Fetch contract copy is in sync.\n");
    return;
  }

  syncFetchContract();
  process.stdout.write("Synced functions/fetch-contract.cjs from services/network/fetch-contract.cjs.\n");
}

if (require.main === module) {
  main();
}

module.exports = {
  functionsPath,
  isFetchContractInSync,
  sourcePath,
  syncFetchContract,
};
