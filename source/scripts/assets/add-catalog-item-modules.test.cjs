const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  inferOpportunityListingKind,
  normalizeTags,
  normalizeWhitespace,
  slugify,
} = require("./lib/catalog-schema.cjs");
const {
  assignCatalogText,
  resolveCatalogExportText,
  safeDisplayLabel,
} = require("./lib/catalog-translations.cjs");
const {
  createXlsxBuffer,
  parseResourceCatalogCsv,
  parseResourceCatalogSpreadsheet,
  resourceCatalogToCsv,
} = require("./lib/catalog-export.cjs");

test("catalog schema helpers normalize ids, tags, and opportunity listing kinds", () => {
  assert.equal(slugify(" Green River Tech Internships! "), "green-river-tech-internships");
  assert.equal(normalizeWhitespace("  financial   aid  "), "financial aid");
  assert.deepEqual(normalizeTags("Scholarship, Transfer; Scholarship"), [
    "scholarship",
    "transfer",
  ]);
  assert.equal(
    inferOpportunityListingKind({
      type: "internship",
      title: "Student employment job board",
      summary: "Search current openings.",
    }),
    "database"
  );
});

test("translation helpers preserve keys when export text matches locale values", () => {
  const target = {};
  assignCatalogText(
    target,
    "title",
    "Tools",
    "resources.tools"
  );

  assert.deepEqual(target, { titleKey: "resources.tools" });
  assert.equal(safeDisplayLabel({ titleKey: "resources.tools" }), "Tools");
  assert.equal(resolveCatalogExportText(target, "title"), "Tools");
});

test("catalog export helpers round-trip resource rows through CSV and XLSX", () => {
  const catalog = [
    {
      id: "student-tools",
      title: "Student Tools",
      icon: "school",
      items: [
        {
          title: "Transfer Planner",
          description: "Plan transfer coursework.",
          url: "https://example.test/planner",
          tags: ["transfer", "planning"],
        },
      ],
    },
  ];

  const csv = resourceCatalogToCsv(catalog);
  const parsedCsv = parseResourceCatalogCsv(csv);
  assert.equal(parsedCsv[0].items[0].title, "Transfer Planner");
  assert.deepEqual(parsedCsv[0].items[0].tags, ["transfer", "planning"]);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gatorguide-catalog-"));
  const xlsxPath = path.join(tmpDir, "resource-export.xlsx");
  fs.writeFileSync(
    xlsxPath,
    createXlsxBuffer([
      {
        name: "Resources",
        rows: [
          ["LINK", "NAME", "DESCRIPTION", "SECTION", "SUBSECTION", "TAGS"],
          [
            "https://example.test/planner",
            "Transfer Planner",
            "Plan transfer coursework.",
            "Student Tools",
            "",
            "transfer; planning",
          ],
        ],
      },
    ])
  );

  const parsedXlsx = parseResourceCatalogSpreadsheet(xlsxPath);
  assert.equal(parsedXlsx[0].items[0].url, "https://example.test/planner");
  assert.equal(parsedXlsx[0].items[0].description, "Plan transfer coursework.");
});
