require("ts-node").register({
  skipProject: true,
  transpileOnly: true,
  compilerOptions: {
    module: "CommonJS",
    moduleResolution: "node",
    jsx: "react-jsx",
    baseUrl: ".",
    paths: {
      "@/*": ["./*"],
    },
  },
});
require("tsconfig-paths/register");

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildSaveInput,
  createBlankDraft,
  validateOpportunityAdminDraft,
} = require("@/components/pages/opportunity-admin/opportunity-admin-draft");
const {
  OPPORTUNITY_DEADLINE_TYPES,
  OPPORTUNITY_STATUSES,
  OPPORTUNITY_TYPES,
} = require("@/constants/opportunities");

test("validateOpportunityAdminDraft requires title and summary before gateway save", () => {
  const blank = createBlankDraft();

  assert.deepEqual(validateOpportunityAdminDraft(blank), {
    isValid: false,
    title: "Missing title",
    message: "Add a title before saving this opportunity.",
  });

  assert.deepEqual(validateOpportunityAdminDraft({ ...blank, title: "Scholarship" }), {
    isValid: false,
    title: "Missing summary",
    message: "Add a short summary before saving this opportunity.",
  });
});

test("buildSaveInput normalizes manual admin drafts for the gateway contract", () => {
  const input = buildSaveInput({
    ...createBlankDraft(),
    opportunityId: " manual-id ",
    type: OPPORTUNITY_TYPES.scholarship,
    status: OPPORTUNITY_STATUSES.active,
    title: "  Transfer Scholarship  ",
    organizationName: "  GatorGuide Foundation ",
    summary: " Helps transfer students. ",
    externalUrl: " https://example.edu/apply ",
    deadlineType: OPPORTUNITY_DEADLINE_TYPES.rolling,
    dueDate: "2026-05-01",
    financialAidTags: "need_based, merit, , fafsa_required",
    suggestedMajors: "computer science, nursing",
    hasToBeMajor: true,
    gpaMin: "3.25",
    residencyTypes: "in state, international",
    communityTags: "lgbtq",
    transferOnly: true,
    recommendationCountMin: "2",
    essayCount: "",
    awardAmountMin: "500",
    awardAmountMax: "1000",
    awardCurrency: "",
    awardRenewable: "true",
    sourceUrl: " https://example.edu/source ",
  });

  assert.equal(input.opportunityId, "manual-id");
  assert.equal(input.title, "Transfer Scholarship");
  assert.equal(input.organizationName, "GatorGuide Foundation");
  assert.equal(input.summary, "Helps transfer students.");
  assert.equal(input.externalUrl, "https://example.edu/apply");
  assert.equal(input.dueDate, null);
  assert.deepEqual(input.financialAidTags, ["need_based", "merit", "fafsa_required"]);
  assert.deepEqual(input.suggestedMajors, ["computer science", "nursing"]);
  assert.equal(input.hasToBeMajor, true);
  assert.equal(input.gpaMin, 3.25);
  assert.deepEqual(input.residencyTypes, ["in state", "international"]);
  assert.deepEqual(input.communityTags, ["lgbtq"]);
  assert.equal(input.transferOnly, true);
  assert.equal(input.recommendationCountMin, 2);
  assert.equal(input.essayCount, null);
  assert.equal(input.awardAmountMin, 500);
  assert.equal(input.awardAmountMax, 1000);
  assert.equal(input.awardCurrency, "USD");
  assert.equal(input.awardRenewable, true);
  assert.equal(input.sourceUrl, "https://example.edu/source");
});
