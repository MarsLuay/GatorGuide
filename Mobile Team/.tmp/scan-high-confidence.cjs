const fs = require("fs");
const p = "constants/transfer-planner-data.ts";
const txt = fs.readFileSync(p, "utf8");
const lines = txt.split(/\r?\n/);
const codeRe = /\b[A-Z]{2,6}&?\s*\d{3}[A-Z]?\b/g;
const denseRe = /\b(allows|requires|equivalent|sequence|path|route|baseline|option|track|admission|prerequisite|do not replace|does not replace|cleanest|strongest|safest|depends on)\b/i;
const out = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const matches = [...line.matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"/g)];
  for (const m of matches) {
    const q = m[1];
    const parts = q.split(/(?<=[.!?])\s+/);
    for (const raw of parts) {
      const s = raw.trim();
      if (!s) continue;
      const codes = (s.match(codeRe) || []).length;
      const isLong = s.length >= 110;
      const hasDense = denseRe.test(s);
      const hasSlash = s.includes(" / ");
      const candidate = isLong && hasDense && (codes >= 1 || hasSlash);
      if (candidate) out.push({ line: i + 1, text: s, codes });
    }
  }
}
const seen = new Set();
const dedup = [];
for (const row of out) {
  const key = row.text;
  if (seen.has(key)) continue;
  seen.add(key);
  dedup.push(row);
}
console.log(JSON.stringify({ count: dedup.length, sample: dedup.slice(0, 40) }, null, 2));
