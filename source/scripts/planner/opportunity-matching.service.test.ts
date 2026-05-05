import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeOpportunity,
  OPPORTUNITY_TYPES,
  OPPORTUNITY_PROGRESS_STATES,
  resolveOpportunityDueDate,
  resolveOpportunityProgress,
  type Opportunity,
} from "@/constants/opportunities";
import { STARTER_OPPORTUNITIES } from "@/constants/starter-opportunities";
import { deadlineCalendarService } from "@/services/deadlines/deadline-calendar.service";
import {
  opportunityMatchingService,
  type MatchedOpportunity,
} from "@/services/opportunities/opportunity-matching.service";
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

function buildDeadlineBoundaryOpportunity(
  input: {
    dueAt?: string | null;
    recurrence?: Partial<Opportunity["recurrence"]>;
    opportunityId?: string;
  } = {}
): Opportunity {
  return normalizeOpportunity({
    opportunityId: input.opportunityId ?? "deadline-boundary-scholarship",
    type: "scholarship",
    status: "active",
    title: "Deadline Boundary Scholarship",
    organizationName: "Boundary Test",
    summary: "Checks that today remains visible until tomorrow.",
    dueAt: input.dueAt ?? new Date(2099, 4, 1, 9).toISOString(),
    recurrence: {
      isYearly: false,
      month: null,
      day: null,
      timezone: "America/Los_Angeles",
      ...(input.recurrence ?? {}),
    },
    deadline: {
      type: "final",
      label: "Deadline",
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
      collegeName: null,
      city: null,
      state: null,
      website: null,
    },
    source: {
      kind: "manual",
      sourceUrl: null,
      sourceLabel: null,
      model: null,
      fetchedAt: null,
      verifiedAt: null,
    },
  });
}

function toLocalDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
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

test("One-time opportunities stay open through their local due date", () => {
  const dueAt = new Date(2099, 4, 1, 9).toISOString();
  const opportunity = buildDeadlineBoundaryOpportunity({ dueAt });

  assert.equal(
    resolveOpportunityProgress(opportunity, null, new Date(2099, 4, 1, 23, 59)),
    null
  );
  assert.equal(
    resolveOpportunityProgress(opportunity, null, new Date(2099, 4, 2, 0, 1)),
    OPPORTUNITY_PROGRESS_STATES.expired
  );
});

test("Yearly opportunities keep the current cycle through their local due date", () => {
  const opportunity = buildDeadlineBoundaryOpportunity({
    dueAt: null,
    recurrence: {
      isYearly: true,
      month: 5,
      day: 1,
    },
  });

  const dueToday = resolveOpportunityDueDate(
    opportunity,
    new Date(2099, 4, 1, 23, 59)
  );
  const dueTomorrow = resolveOpportunityDueDate(
    opportunity,
    new Date(2099, 4, 2, 0, 1)
  );

  assert.equal(dueToday?.getFullYear(), 2099);
  assert.equal(dueToday?.getMonth(), 4);
  assert.equal(dueToday?.getDate(), 1);
  assert.equal(dueTomorrow?.getFullYear(), 2100);
});

test("Upcoming deadline filters include deadlines due earlier today until tomorrow", () => {
  const dueDate = new Date(2099, 4, 1, 9);
  const entry = {
    id: "opportunity:deadline-boundary-scholarship",
    dateKey: toLocalDateKey(dueDate),
    dueAt: dueDate.toISOString(),
    title: "Deadline Boundary Scholarship",
    subtitle: "Boundary Test",
    description: "Checks that today remains visible until tomorrow.",
    kind: "scholarship" as const,
    sourceLabel: "Opportunity",
    isDone: false,
    target: {
      type: "external" as const,
      url: "https://example.com",
    },
  };
  const originalDateNow = Date.now;

  try {
    Date.now = () => new Date(2099, 4, 1, 23, 59).getTime();
    assert.deepEqual(
      deadlineCalendarService
        .filterUpcomingEntries([entry])
        .map((item) => item.id),
      [entry.id]
    );

    Date.now = () => new Date(2099, 4, 2, 0, 1).getTime();
    assert.deepEqual(deadlineCalendarService.filterUpcomingEntries([entry]), []);
  } finally {
    Date.now = originalDateNow;
  }
});

test("Deadline calendar keeps the stored occurrence when a recurring opportunity rolls forward", () => {
  const originalDueDate = new Date(2099, 4, 1, 9);
  const nextDueDate = new Date(2100, 4, 1, 9);
  const opportunity: MatchedOpportunity = {
    ...buildDeadlineBoundaryOpportunity({
      dueAt: originalDueDate.toISOString(),
      recurrence: {
        isYearly: true,
        month: 5,
        day: 1,
      },
    }),
    computedDueAt: nextDueDate.toISOString(),
    progress: null,
    isDone: false,
    matchScore: 0,
    matchReasons: [],
  };

  const entries = deadlineCalendarService.buildOpportunityEntries([opportunity]);

  assert.deepEqual(
    entries.map((entry) => entry.dateKey),
    [toLocalDateKey(originalDueDate), toLocalDateKey(nextDueDate)]
  );
  assert.equal(new Set(entries.map((entry) => entry.id)).size, 2);
});

test("Quarter calendar opportunities stay out of the scholarship category", () => {
  const quarterOpportunities = STARTER_OPPORTUNITIES.filter((opportunity) =>
    /^grc-quarter-(?:start|end)-/.test(opportunity.opportunityId)
  ).map((opportunity) => normalizeOpportunity(opportunity));
  const quarterTypeCounts = quarterOpportunities.reduce<Record<string, number>>(
    (counts, opportunity) => ({
      ...counts,
      [opportunity.type]: (counts[opportunity.type] ?? 0) + 1,
    }),
    {}
  );
  const matched = opportunityMatchingService.matchOpportunities(quarterOpportunities, {
    user: null,
    questionnaireAnswers: {},
    statusById: {},
  });
  const entries = deadlineCalendarService.buildOpportunityEntries(matched);

  assert.equal(quarterOpportunities.length, 24);
  assert.equal(quarterTypeCounts[OPPORTUNITY_TYPES.quarterStart], 12);
  assert.equal(quarterTypeCounts[OPPORTUNITY_TYPES.quarterEnd], 12);
  assert.equal(quarterTypeCounts[OPPORTUNITY_TYPES.scholarship] ?? 0, 0);
  assert.ok(
    entries.every((entry) =>
      entry.kind === OPPORTUNITY_TYPES.quarterStart ||
      entry.kind === OPPORTUNITY_TYPES.quarterEnd
    )
  );
  assert.ok(entries.every((entry) => entry.sourceLabel === "Academic calendar"));
});

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
