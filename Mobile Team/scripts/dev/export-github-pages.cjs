const { execSync, spawnSync } = require("node:child_process");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..", "..");

function normalizeBaseUrl(value) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "";
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

function parseRepoNameFromRemote(value) {
  const normalized = String(value ?? "").trim().replace(/\\/g, "/");
  if (!normalized) return "";

  const lastSegment = normalized.split("/").pop() ?? "";
  return lastSegment.replace(/\.git$/i, "").trim();
}

function resolveGithubPagesBaseUrl() {
  const explicitBaseUrl = normalizeBaseUrl(process.env.EXPO_PUBLIC_GITHUB_PAGES_BASE_URL);
  if (explicitBaseUrl) {
    return explicitBaseUrl;
  }

  const repoFromGitHub = String(process.env.GITHUB_REPOSITORY ?? "")
    .trim()
    .split("/")
    .pop();
  if (repoFromGitHub) {
    return `/${repoFromGitHub}`;
  }

  try {
    const remoteUrl = execSync("git config --get remote.origin.url", {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const repoName = parseRepoNameFromRemote(remoteUrl);
    if (repoName) {
      return `/${repoName}`;
    }
  } catch {
    // Fall back to the repo folder name when git metadata is unavailable.
  }

  return `/${path.basename(path.resolve(projectRoot, ".."))}`;
}

const pagesBaseUrl = resolveGithubPagesBaseUrl();
const command =
  process.platform === "win32"
    ? {
        file: "cmd.exe",
        args: ["/d", "/s", "/c", "npx expo export --platform web --output-dir dist"],
      }
    : {
        file: "npx",
        args: ["expo", "export", "--platform", "web", "--output-dir", "dist"],
      };

const result = spawnSync(command.file, command.args, {
  cwd: projectRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    EXPO_PUBLIC_GITHUB_PAGES: "1",
    EXPO_PUBLIC_GITHUB_PAGES_BASE_URL: pagesBaseUrl,
  },
});

if (result.error) {
  console.error(result.error);
}

if (typeof result.status === "number") {
  process.exit(result.status);
}

process.exit(1);
