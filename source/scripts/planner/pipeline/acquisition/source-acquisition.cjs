
"use strict";
const { createSourceDownloader, isRetryableHttpStatus } = require("../../lib/source-fetching.cjs");

const OFFICIAL_HOST_SUFFIXES = [
  "washington.edu",
  "uw.edu",
  "greenriver.edu",
  "uwb.edu",
  "tacoma.uw.edu",
];

function isOfficialDomain(urlString) {
  try {
    const host = new URL(urlString).hostname.toLowerCase();
    return OFFICIAL_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
  } catch {
    return false;
  }
}

function createSourceAcquisition(options = {}) {
  const downloader = options.downloader || createSourceDownloader(options);
  return {
    isOfficialDomain,
    isRetryableHttpStatus,
    async acquire(url, timeoutMs = 15000) {
      if (!isOfficialDomain(url) && !options.allowNonOfficial) {
        return { ok: false, error: "non-official-domain", url };
      }
      try {
        const result = await downloader.downloadSource(url, timeoutMs);
        return { ok: true, url, ...result };
      } catch (error) {
        return { ok: false, url, error: error instanceof Error ? error.message : String(error) };
      }
    },
  };
}

module.exports = { createSourceAcquisition, isOfficialDomain, OFFICIAL_HOST_SUFFIXES };
