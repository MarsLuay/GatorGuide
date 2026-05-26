const assert = require("node:assert/strict");
const test = require("node:test");
const { HttpsError } = require("firebase-functions/v2/https");
const { __test } = require("./opportunityGateway");

test("opportunity admin decisions honor configured uid and email allowlists", () => {
  const previousEmails = process.env.OPPORTUNITY_ADMIN_EMAILS;
  const previousUids = process.env.OPPORTUNITY_ADMIN_UIDS;

  try {
    process.env.OPPORTUNITY_ADMIN_EMAILS = "admin@example.com, second@example.com";
    process.env.OPPORTUNITY_ADMIN_UIDS = "uid-1,uid-2";

    assert.deepEqual(
      __test.parseConfigList(process.env.OPPORTUNITY_ADMIN_EMAILS, {
        normalizeCase: "lower",
      }),
      ["admin@example.com", "second@example.com"]
    );

    assert.equal(
      __test.getOpportunityAdminDecision({
        auth: { uid: "uid-2", token: { email: "student@example.com" } },
      }).authorizedBy,
      "uid"
    );
    assert.equal(
      __test.getOpportunityAdminDecision({
        auth: { uid: "other", token: { email: "ADMIN@EXAMPLE.COM" } },
      }).authorizedBy,
      "email"
    );
    assert.equal(
      __test.getOpportunityAdminDecision({
        auth: { uid: "other", token: { email: "student@example.com" } },
      }).authorized,
      false
    );
  } finally {
    if (previousEmails === undefined) {
      delete process.env.OPPORTUNITY_ADMIN_EMAILS;
    } else {
      process.env.OPPORTUNITY_ADMIN_EMAILS = previousEmails;
    }
    if (previousUids === undefined) {
      delete process.env.OPPORTUNITY_ADMIN_UIDS;
    } else {
      process.env.OPPORTUNITY_ADMIN_UIDS = previousUids;
    }
  }
});

test("manual opportunity payloads sanitize strings, urls, tags, numbers, and booleans", () => {
  const now = new Date("2026-01-15T12:00:00.000Z");
  const { opportunityId, payload } = __test.buildManualOpportunityPayload(
    {
      opportunityId: " Manual Scholarship! ",
      title: `${"Transfer Scholarship ".repeat(20)}`,
      organizationName: "",
      summary: "summary ".repeat(200),
      type: "INTERNSHIP",
      status: "DRAFT",
      externalUrl: "example.edu/apply",
      dueDate: "2026-04-30",
      isYearly: "yes",
      deadlineType: "priority",
      financialAidTags: ["Need_Based", "need_based", " Merit "],
      suggestedMajors: "Computer Science, computer science, Nursing",
      hasToBeMajor: "true",
      gpaMin: "9",
      residencyTypes: "In_State,out_of_state,IN_STATE",
      communityTags: ["LGBTQ", "lgbtq", ""],
      transferOnly: "on",
      recommendationCountMin: "99",
      essayCount: "-4",
      awardAmountMin: "-20",
      awardAmountMax: "999999999999",
      awardCurrency: "usd",
      awardAmountText: "amount ".repeat(50),
      awardRenewable: "false",
      collegeId: "college-123",
      collegeName: "Example University",
      collegeCity: "Auburn",
      collegeState: "Washington",
      collegeWebsite: "example.edu",
      sourceUrl: "https://example.edu/scholarship",
      sourceLabel: "",
    },
    now
  );

  assert.equal(opportunityId, "Manual Scholarship!");
  assert.equal(payload.title.length, 180);
  assert.equal(payload.organizationName, payload.title);
  assert.equal(payload.summary.length, 600);
  assert.equal(payload.type, "internship");
  assert.equal(payload.status, "draft");
  assert.equal(payload.externalUrl, "https://example.edu/apply");
  assert.equal(payload.recurrence.month, 4);
  assert.equal(payload.recurrence.day, 30);
  assert.equal(payload.deadline.type, "priority");
  assert.deepEqual(payload.matching.financialAidTags, ["need_based", "merit"]);
  assert.deepEqual(payload.matching.suggestedMajors, ["computer science", "nursing"]);
  assert.equal(payload.matching.hasToBeMajor, true);
  assert.equal(payload.eligibility.gpaMin, 4.5);
  assert.deepEqual(payload.eligibility.residencyTypes, ["in_state", "out_of_state"]);
  assert.deepEqual(payload.eligibility.communityTags, ["lgbtq"]);
  assert.equal(payload.eligibility.transferOnly, true);
  assert.equal(payload.requirements.needsRecommendations, true);
  assert.equal(payload.requirements.recommendationCountMin, 12);
  assert.equal(payload.requirements.essayCount, 0);
  assert.equal(payload.award.amountMin, 0);
  assert.equal(payload.award.amountMax, 100000000);
  assert.equal(payload.award.currency, "USD");
  assert.equal(payload.award.amountText.length, 160);
  assert.equal(payload.award.renewable, false);
  assert.equal(payload.college.website, "https://example.edu/");
  assert.equal(payload.source.sourceLabel, "Opportunity Admin");
});

test("manual opportunity payloads reject empty titles with callable errors", () => {
  assert.throws(
    () => __test.buildManualOpportunityPayload({ title: "   " }, new Date()),
    (error) => error instanceof HttpsError && error.code === "invalid-argument"
  );
});

test("deadline helpers bound dates and clean scraped evidence text", () => {
  assert.equal(
    __test.buildIsoDueDate("2026-04-30", "America/Los_Angeles"),
    "2026-04-30T09:00:00.000-07:00"
  );
  assert.equal(__test.buildIsoDueDate("not-a-date", "UTC"), null);
  assert.deepEqual(__test.getMonthDayFromIso("2026-04-30"), { month: 4, day: 30 });
  assert.equal(__test.normalizeDeadlineType("rolling"), "rolling");
  assert.equal(__test.normalizeOpportunityStatus("missing"), "active");
  assert.equal(__test.normalizeOpportunityType("unknown"), "scholarship");

  const text = __test.stripHtmlToText(
    "<title>Deadline</title><script>alert(1)</script><style>.x{}</style><p>Apply &amp; verify</p>"
  );
  assert.equal(text, "Deadline Apply & verify");
});

test("search result extraction keeps official urls and unwraps DuckDuckGo redirects", () => {
  const html = [
    '<a href="/l/?uddg=https%3A%2F%2Fwww.example.edu%2Fadmissions%3Fa%3D1%26b%3D2">official</a>',
    '<a href="https://sub.example.edu/deadlines">subdomain</a>',
    '<a href="https://spam.test/deadline">spam</a>',
  ].join("");

  assert.deepEqual(__test.extractSearchResultUrls(html, "example.edu"), [
    "https://www.example.edu/admissions?a=1&b=2",
    "https://sub.example.edu/deadlines",
  ]);
});
