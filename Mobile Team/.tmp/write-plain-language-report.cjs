const fs = require("fs");
const sourcePath = "constants/transfer-planner-data.ts";
const reportPath = "docs/planner/PLAIN_LANGUAGE_REWRITE_CANDIDATES.md";
const txt = fs.readFileSync(sourcePath, "utf8");
const lines = txt.split(/\r?\n/);
const codeRe = /\b[A-Z]{2,6}&?\s*\d{3}[A-Z]?\b/g;
const denseRe = /\b(allows|requires|equivalent|equivalency|sequence|path|route|baseline|option|track|admission|prerequisite|do not replace|does not replace|cleanest|strongest|safest|support|not required|worth finishing|head start|defaults to)\b/i;
const rows = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const matches = [...line.matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"/g)];
  for (const m of matches) {
    const q = m[1];
    const parts = q.split(/(?<=[.!?])\s+/);
    for (const raw of parts) {
      const s = raw.trim();
      if (!s) continue;
      const hasDense = denseRe.test(s);
      const hasCode = (s.match(codeRe) || []).length >= 1;
      const hasSlash = s.includes(" / ");
      if (s.length >= 45 && hasDense && (hasCode || hasSlash)) {
        rows.push({ line: i + 1, text: s });
      }
    }
  }
}
const seen = new Set();
const dedup = [];
for (const row of rows) {
  if (seen.has(row.text)) continue;
  seen.add(row.text);
  dedup.push(row);
}
dedup.sort((a,b)=>a.line-b.line || a.text.localeCompare(b.text));
const out = [];
out.push("# Plain-Language Rewrite Candidates (Transfer Planner Data)");
out.push("");
out.push(`Source: ${sourcePath}`);
out.push(`Generated: ${new Date().toISOString()}`);
out.push(`Candidate count: ${dedup.length}`);
out.push("");
out.push("Selection criteria used:");
out.push("- sentence length >= 45");
out.push("- contains technical transfer-planning wording (for example: allows, requires, sequence, path, equivalent, cleanest)");
out.push("- includes at least one course code or slash-path expression");
out.push("");
out.push("## Candidates");
out.push("");
for (const row of dedup) {
  out.push(`- Line ${row.line}: ${row.text}`);
}
fs.writeFileSync(reportPath, out.join("\n"));
console.log(`Wrote ${reportPath} with ${dedup.length} candidates.`);
