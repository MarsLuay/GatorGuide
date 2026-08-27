const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const path = require("node:path");
const fs = require("node:fs");

function readSource(relativePath) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function stripComments(source) {
  return String(source ?? "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function readCode(relativePath) {
  return stripComments(readSource(relativePath));
}

describe("AiGatewayService context compilation execution", () => {
    describe("buildSystemPrompt", () => {
        const source = readCode("services/ai/ai-gateway.service.ts");
        const match = source.match(/buildSystemPrompt\s*\([^)]*\)\s*:\s*string\s*{([\s\S]*?)\n\s*}\n\n\s*private normalizeError/);

        if (!match) {
             throw new Error("Could not find buildSystemPrompt in ai-gateway.service.ts");
        }

        const fnBody = match[1];
        const buildSystemPrompt = new Function('context', fnBody);

        it("handles context with no profile or preferences", () => {
             const context = {};
             const result = buildSystemPrompt(context);
             assert.equal(result, "You are a helpful college advising assistant.");
        });

        it("handles context with profile major but no preferences", () => {
             const context = {
                 profile: { major: "Computer Science" }
             };
             const result = buildSystemPrompt(context);
             assert.equal(result, "You are a helpful college advising assistant.\nUser is interested in Computer Science.");
        });

        it("handles context with preferences location but no profile", () => {
             const context = {
                 preferences: { location: "Seattle, WA" }
             };
             const result = buildSystemPrompt(context);
             assert.equal(result, "You are a helpful college advising assistant.\nUser prefers Seattle, WA.");
        });

        it("handles context with both profile major and preferences location", () => {
             const context = {
                 profile: { major: "Computer Science" },
                 preferences: { location: "Seattle, WA" }
             };
             const result = buildSystemPrompt(context);
             assert.equal(result, "You are a helpful college advising assistant.\nUser is interested in Computer Science.\nUser prefers Seattle, WA.");
        });

        it("handles context with empty strings", () => {
             const context = {
                 profile: { major: "" },
                 preferences: { location: "" }
             };
             const result = buildSystemPrompt(context);
             assert.equal(result, "You are a helpful college advising assistant.");
        });
    });
});
