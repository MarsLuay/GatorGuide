const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..", "..");
const firebaseBin = process.platform === "win32"
  ? path.join(projectRoot, "node_modules", ".bin", "firebase.cmd")
  : path.join(projectRoot, "node_modules", ".bin", "firebase");
const command = `"${firebaseBin}" emulators:exec --project demo-gatorguide --only firestore,storage "node scripts/qa/firebase-rules.test.cjs"`;

function resolveJavaHome() {
  const toolsRoot = path.join(projectRoot, ".tools", "microsoft-jdk-21");
  if (!fs.existsSync(toolsRoot)) {
    return process.env.JAVA_HOME ?? null;
  }

  const bundledJdk = fs.readdirSync(toolsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.toLowerCase().startsWith("jdk-"))
    .map((entry) => path.join(toolsRoot, entry.name))[0];

  return bundledJdk ?? process.env.JAVA_HOME ?? null;
}

const javaHome = resolveJavaHome();
const env = { ...process.env };

if (javaHome) {
  env.JAVA_HOME = javaHome;
  env.PATH = `${path.join(javaHome, "bin")}${path.delimiter}${process.env.PATH ?? ""}`;
}

const result = spawnSync(command, {
  cwd: projectRoot,
  stdio: "inherit",
  shell: true,
  env,
});

if (result.error) {
  throw result.error;
}

process.exitCode = result.status ?? 1;
