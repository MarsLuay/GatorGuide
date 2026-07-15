"use strict";

/** P07-A course identity normalization (safe aliases / compact codes). */

function normalizeCourseCode(raw) {
  const text = String(raw || "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
  const compact = text.replace(/\s+/g, "");
  const spaced = compact.replace(/^([A-Z&]+)(\d)/, "$1 $2");
  return {
    raw: String(raw || ""),
    display: spaced,
    compact,
  };
}

function dedupeCourseObligations(codes) {
  const seen = new Set();
  const out = [];
  for (const code of codes || []) {
    const n = normalizeCourseCode(code);
    if (!n.compact || seen.has(n.compact)) continue;
    seen.add(n.compact);
    out.push(n);
  }
  return out;
}

module.exports = { normalizeCourseCode, dedupeCourseObligations };
