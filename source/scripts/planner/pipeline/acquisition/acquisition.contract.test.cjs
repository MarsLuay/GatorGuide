
const assert = require("node:assert/strict");
const test = require("node:test");
const { createSourceAcquisition, isOfficialDomain } = require("./source-acquisition.cjs");
const { createRawSnapshot, dedupeSnapshots, contentAddress } = require("./raw-snapshot.cjs");
const { htmlToSourceDocument, pdfTextToSourceDocument } = require("../document/source-document.cjs");

test("P04-A official domain gate", () => {
  assert.equal(isOfficialDomain("https://www.washington.edu/cs"), true);
  assert.equal(isOfficialDomain("https://evil.example"), false);
});

test("P04-A acquisition uses fixture downloader", async () => {
  const acquisition = createSourceAcquisition({
    downloader: {
      downloadSource: async (url) => ({ body: "ok", fetchMode: "fixture", url }),
    },
  });
  const result = await acquisition.acquire("https://cs.washington.edu/program");
  assert.equal(result.ok, true);
  assert.equal(result.body, "ok");
});

test("P04-B snapshots are content-addressed and dedupe", () => {
  const a = createRawSnapshot({ body: "same", sourceUrl: "https://a" });
  const b = createRawSnapshot({ body: "same", sourceUrl: "https://b" });
  const c = createRawSnapshot({ body: "diff", sourceUrl: "https://c" });
  assert.equal(a.contentHash, b.contentHash);
  assert.equal(contentAddress("same"), a.contentHash);
  assert.equal(dedupeSnapshots([a, b, c]).length, 2);
});

test("P04-C source documents stay transport-level", () => {
  const doc = htmlToSourceDocument({
    html: '<h1>CS</h1><a href="/x">x</a>',
    sourceUrl: "https://cs.washington.edu",
    snapshotId: "abc",
  });
  assert.equal(doc.kind, "source-document");
  assert.equal(doc.pages[0].headings[0].text, "CS");
  assert.ok(doc.pages[0].links.includes("/x"));
  const pdf = pdfTextToSourceDocument({ text: "page", pageTexts: ["p0", "p1"] });
  assert.equal(pdf.pages.length, 2);
});
