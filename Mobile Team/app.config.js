const appJson = require("./app.json");

const baseExpoConfig = appJson.expo ?? {};

function normalizeBaseUrl(value) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "";
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

function shouldEnableGithubPagesBaseUrl() {
  const requested = String(process.env.EXPO_PUBLIC_GITHUB_PAGES ?? "").trim().toLowerCase();
  return requested === "1" || requested === "true" || process.env.GITHUB_ACTIONS === "true";
}

function resolveGithubPagesBaseUrl() {
  const explicitBaseUrl = normalizeBaseUrl(process.env.EXPO_PUBLIC_GITHUB_PAGES_BASE_URL);
  if (explicitBaseUrl) {
    return explicitBaseUrl;
  }

  if (!shouldEnableGithubPagesBaseUrl()) {
    return normalizeBaseUrl(baseExpoConfig.experiments?.baseUrl);
  }

  const repoName = String(process.env.GITHUB_REPOSITORY ?? "")
    .trim()
    .split("/")
    .pop();

  if (!repoName) {
    return normalizeBaseUrl(baseExpoConfig.experiments?.baseUrl);
  }

  return `/${repoName}`;
}

const baseUrl = resolveGithubPagesBaseUrl();

module.exports = {
  ...baseExpoConfig,
  experiments: {
    ...(baseExpoConfig.experiments ?? {}),
    ...(baseUrl ? { baseUrl } : {}),
  },
};
