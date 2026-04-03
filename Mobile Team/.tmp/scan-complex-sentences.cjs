const fs = require("fs");
const p = "constants/transfer-planner-data.ts";
const txt = fs.readFileSync(p, "utf8");
const lines = txt.split(/\r?\n/);
const codeRe = /\b[A-Z]{2,6}&?\s*\d{3}[A-Z]?\b/g;
const kwRe = /\b(allows|requires|depends|baseline|path|equivalent|sequence|admission|prerequisite|progression|route|option|concentration)\b/i;
const out = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const matches = [...line.matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"/g)];
  const qs = matches.map((m) => m[1]);
  for (const q of qs) {
    const sentenceParts = q.split(/(?<=[.!?])\s+/);
    for (const s0 of sentenceParts) {
      const s = s0.trim();
      if (!s) continue;
      const codes = (s.match(codeRe) || []).length;
      const isLong = s.length >= 95;
      const hasSlash = s.includes(" / ");
      const hasOr = /\bor\b/i.test(s);
      const hasKw = kwRe.test(s);
      if (isLong && (codes >= 1 || hasSlash || hasOr) && hasKw) {
        out.push({ line: i + 1, text: s, codes });
      }
    }
  }
}
const seen = new Set();
const dedup = [];
for (const row of out) {
  if (seen.has(row.text)) continue;
  seen.add(row.text);
  dedup.push(row);
}
console.log(JSON.stringify({ count: dedup.length, sample: dedup.slice(0, 30) }, null, 2));
