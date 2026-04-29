import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeOpportunity,
  type Opportunity,
} from "@/constants/opportunities";
import { STARTER_OPPORTUNITIES } from "@/constants/starter-opportunities";
import { deadlineCalendarService } from "@/services/deadlines/deadline-calendar.service";
import { opportunityMatchingService } from "@/services/opportunities/opportunity-matching.service";
import {
  estimateTransferPlannerTranscriptCurrentCredits,
  TRANSCRIPT_COURSES_FIELD,
  TRANSCRIPT_EARNED_CREDITS_FIELD,
} from "@/services/planning/transfer-planner-cache.service";

function buildGreenRiverEnrollmentOpportunity(bucket: string): Opportunity {
  return normalizeOpportunity({
    opportunityId: `green-river-current-returning-enrollment-${bucket}-credits-for-summer-fall-2099`,
    type: "college_deadline",
    status: "active",
    title: `Green River Current/Returning Enrollment: ${bucket} credits`,
    organizationName: "Green River College Office of the Registrar",
    summary: "Class enrollment opens by completed/evaluated credit bucket.",
    dueAt: "2099-05-01T15:00:00.000Z",
    recurrence: {
      isYearly: false,
      month: null,
      day: null,
      timezone: "America/Los_Angeles",
    },
    deadline: {
      type: "final",
      label: "Class enrollment opens",
    },
    matching: {
      financialAidTags: [],
      suggestedMajors: [],
      hasToBeMajor: false,
    },
    eligibility: {
      gpaMin: null,
      residencyTypes: [],
      transferOnly: false,
    },
    requirements: {
      needsRecommendations: false,
      recommendationCountMin: 0,
      essayCount: 0,
    },
    award: {
      amountMin: null,
      amountMax: null,
      currency: "USD",
      amountText: null,
      renewable: null,
    },
    college: {
      collegeId: null,
      collegeName: "Green River College",
      city: "Auburn",
      state: "WA",
      website: "https://www.greenriver.edu/",
    },
    source: {
      kind: "manual",
      sourceUrl: "https://www.greenriver.edu/students/academics/office-of-the-registrar/index.html",
      sourceLabel: "Green River Office of the Registrar Important Upcoming Dates",
      model: null,
      fetchedAt: null,
      verifiedAt: null,
    },
  });
}

const staleTranscriptAnswers = {
  [TRANSCRIPT_EARNED_CREDITS_FIELD]: 45,
  [TRANSCRIPT_COURSES_FIELD]: [
    {
      code: "MATH& 151",
      label: "MATH& 151 Calculus I",
      credits: 5,
      termLabel: "Spring 2098",
      termStartDate: "2098-04-01",
      termEndDate: "2098-06-20",
    },
  ],
};

test("Transcript credit estimate adds 15 credits for completed fall, winter, and spring terms after stale transcript data", () => {
  const estimate = estimateTransferPlannerTranscriptCurrentCredits(
    staleTranscriptAnswers,
    { asOf: "2099-05-01T15:00:00.000Z" }
  );

  assert.equal(estimate?.earnedCreditsTotal, 45);
  assert.equal(estimate?.estimatedAdditionalCredits, 30);
  assert.equal(estimate?.estimatedCurrentCreditsTotal, 75);
  assert.deepEqual(estimate?.estimatedTerms, ["Fall 2098", "Winter 2099"]);
});

test("Green River current/returning enrollment deadlines use projected transcript credits for bucket matching", () => {
  const matched = opportunityMatchingService.matchOpportunities(
    [
      buildGreenRiverEnrollmentOpportunity("90plus"),
      buildGreenRiverEnrollmentOpportunity("60-89"),
      buildGreenRiverEnrollmentOpportunity("30-59"),
      buildGreenRiverEnrollmentOpportunity("0-29"),
    ],
    {
      user: null,
      questionnaireAnswers: staleTranscriptAnswers,
      statusById: {},
    }
  );

  assert.deepEqual(
    matched.map((opportunity) => opportunity.opportunityId),
    ["green-river-current-returning-enrollment-60-89-credits-for-summer-fall-2099"]
  );
  assert.match(
    matched[0]?.matchReasons.join(" ") ?? "",
    /Estimated credits by enrollment date: 75 \(45 transcript \+ 30 projected\)/
  );
});

test("Green River Summer/Fall class enrollment starter deadlines are combined and yearly", () => {
  const enrollmentOpportunities = STARTER_OPPORTUNITIES.filter((opportunity) =>
    /^green-river-(?:priority-enrollment|current-returning-enrollment|new-student-enrollment)/.test(
      opportunity.opportunityId
    )
  );
  const opportunityIds = new Set(
    enrollmentOpportunities.map((opportunity) => opportunity.opportunityId)
  );
  const summerFallOpportunities = enrollmentOpportunities.filter((opportunity) =>
    opportunity.opportunityId.includes("summer-fall-2026")
  );

  assert.equal(opportunityIds.has("green-river-priority-enrollment-for-summer-2026"), false);
  assert.equal(opportunityIds.has("green-river-priority-enrollment-for-fall-2026"), false);
  assert.equal(
    opportunityIds.has("green-river-priority-enrollment-for-summer-fall-2026"),
    true
  );
  assert.equal(summerFallOpportunities.length, 6);
  assert.ok(
    enrollmentOpportunities.every((opportunity) => opportunity.recurrence.isYearly)
  );
});

test("UW Seattle transfer application starter deadlines stay out of home upcoming deadlines", () => {
  const uwTransferOpportunities = STARTER_OPPORTUNITIES.filter((opportunity) =>
    opportunity.opportunityId.startsWith(
      "uw-seattle-transfer-application-deadline-"
    )
  );
  const opportunityById = new Map(
    uwTransferOpportunities.map((opportunity) => [
      opportunity.opportunityId,
      opportunity,
    ])
  );
  const matched = opportunityMatchingService.matchOpportunities(
    uwTransferOpportunities.map((opportunity) => normalizeOpportunity(opportunity)),
    {
      user: null,
      questionnaireAnswers: {},
      statusById: {},
    }
  );
  const entries = deadlineCalendarService.buildOpportunityEntries(matched);

  assert.equal(uwTransferOpportunities.length, 3);
  assert.equal(
    opportunityById.get(
      "uw-seattle-transfer-application-deadline-for-winter-admission"
    )?.recurrence.month,
    9
  );
  assert.equal(
    opportunityById.get(
      "uw-seattle-transfer-application-deadline-for-autumn-summer-admission"
    )?.recurrence.month,
    2
  );
  assert.equal(
    opportunityById.get(
      "uw-seattle-transfer-application-deadline-for-spring-admission"
    )?.recurrence.month,
    12
  );
  assert.equal(entries.length, 3);
  assert.ok(entries.every((entry) => entry.hideFromHomeUpcoming));
  assert.ok(entries.every((entry) => entry.revealInCalendarOnlyWhenSelected));
});
