const fs = require("fs");
const path = require("path");

function serializeJsonReport(report) {
  return `${JSON.stringify(report, null, 2)}\n`;
}

function serializeMarkdownLines(lines) {
  return `${(lines ?? []).join("\n")}\n`;
}

function writeJsonReport(filePath, report) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, serializeJsonReport(report));
}

function writeMarkdownReport(filePath, markdownOrLines) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const markdown = Array.isArray(markdownOrLines)
    ? serializeMarkdownLines(markdownOrLines)
    : String(markdownOrLines ?? "");
  fs.writeFileSync(filePath, markdown.endsWith("\n") ? markdown : `${markdown}\n`);
}

function writeReportPair(input) {
  writeJsonReport(input.jsonPath, input.report);
  writeMarkdownReport(input.markdownPath, input.markdown);
}

module.exports = {
  serializeJsonReport,
  serializeMarkdownLines,
  writeJsonReport,
  writeMarkdownReport,
  writeReportPair,
};
