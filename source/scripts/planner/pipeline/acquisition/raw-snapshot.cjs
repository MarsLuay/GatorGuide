
"use strict";
const crypto = require("node:crypto");

function contentAddress(bytes) {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes || "");
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function createRawSnapshot({ body, headers = {}, contentType = null, sourceUrl, catalogYear = null }) {
  const bytes = Buffer.isBuffer(body) ? body : Buffer.from(String(body || ""), "utf8");
  const hash = contentAddress(bytes);
  return {
    snapshotId: hash,
    contentHash: hash,
    byteLength: bytes.length,
    contentType: contentType || headers["content-type"] || null,
    sourceUrl: sourceUrl || null,
    catalogYear: catalogYear || null,
    headers: { ...headers },
  };
}

function dedupeSnapshots(snapshots) {
  const map = new Map();
  for (const snap of snapshots) {
    map.set(snap.contentHash, snap);
  }
  return [...map.values()];
}

module.exports = { contentAddress, createRawSnapshot, dedupeSnapshots };
