const fs = require("fs");
const path = "constants/transfer-planner-data.ts";
const lines = fs.readFileSync(path, "utf8").split(/\r?\n/);
const re = /(cleanest direct|direct .*equivalent|equivalent preparation)/i;
for (let i = 0; i < lines.length; i++) {
  if (!re.test(lines[i])) continue;
  const start = Math.max(0, i - 3);
  const end = Math.min(lines.length - 1, i + 3);
  console.log("\n---");
  for (let j = start; j <= end; j++) {
    const n = String(j + 1).padStart(5, " ");
    console.log(`${n}: ${lines[j]}`);
  }
}
