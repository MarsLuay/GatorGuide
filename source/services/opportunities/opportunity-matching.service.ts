import type { User, QuestionnaireAnswers } from "@/hooks/use-app-data";
import {
  type Opportunity,
  type OpportunityCommunityTag,
  type UserOpportunityStatus,
  type OpportunityFinancialAidTag,
  type OpportunityProgressState,
  isOpportunityDoneForCurrentCycle,
  normalizeMajorTag,
  normalizeResidencyTag,
  OPPORTUNITY_COMMUNITY_TAGS,
  OPPORTUNITY_FINANCIAL_AID_TAGS,
  OPPORTUNITY_DEADLINE_TYPES,
  OPPORTUNITY_PROGRESS_STATES,
  OPPORTUNITY_STATUSES,
  OPPORTUNITY_TYPES,
  resolveOpportunityProgress,
  resolveOpportunityDueDate,
} from "@/constants/opportunities";
import { QUESTIONNAIRE_FIELD_IDS } from "@/constants/schema";
import {
  estimateTransferPlannerTranscriptCurrentCredits,
} from "@/services/planning/transfer-planner-cache.service";

export type MatchedOpportunity = Opportunity & {
  computedDueAt: string | null;
  progress: OpportunityProgressState | null;
  isDone: boolean;
  matchScore: number;
  matchReasons: string[];
};

type MatchInput = {
  user: User | null;
  questionnaireAnswers: QuestionnaireAnswers;
  statusById: Record<string, UserOpportunityStatus | undefined>;
};

type GreenRiverEnrollmentCreditBucket = "90plus" | "60-89" | "30-59" | "0-29";

const GREEN_RIVER_CURRENT_RETURNING_ENROLLMENT_PATTERN =
  /^green-river-current-returning-enrollment-(90plus|60-89|30-59|0-29)-credits-for-/;

const GREEN_RIVER_ENROLLMENT_CREDIT_BUCKET_LABELS: Record<
  GreenRiverEnrollmentCreditBucket,
  string
> = {
  "90plus": "90+ credits",
  "60-89": "60-89 credits",
  "30-59": "30-59 credits",
  "0-29": "0-29 credits",
};

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function getGreenRiverEnrollmentCreditBucket(
  earnedCreditsTotal: number
): GreenRiverEnrollmentCreditBucket {
  if (earnedCreditsTotal >= 90) return "90plus";
  if (earnedCreditsTotal >= 60) return "60-89";
  if (earnedCreditsTotal >= 30) return "30-59";
  return "0-29";
}

function getOpportunityGreenRiverEnrollmentCreditBucket(
  opportunity: Opportunity
): GreenRiverEnrollmentCreditBucket | null {
  const match = String(opportunity.opportunityId ?? "").match(
    GREEN_RIVER_CURRENT_RETURNING_ENROLLMENT_PATTERN
  );
  return (match?.[1] as GreenRiverEnrollmentCreditBucket | undefined) ?? null;
}

function formatCreditAmount(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

function getGreenRiverEnrollmentCreditEstimate(
  opportunity: Opportunity,
  input: MatchInput,
  dueDate: Date | null
) {
  const opportunityBucket = getOpportunityGreenRiverEnrollmentCreditBucket(opportunity);
  if (!opportunityBucket) return null;

  return estimateTransferPlannerTranscriptCurrentCredits(input.questionnaireAnswers, {
    asOf: dueDate ?? new Date(),
  });
}

function formatRequirementCountLabel(
  count: number,
  singular: string,
  plural: string = `${singular}s`
) {
  if (count <= 0) return "";
  if (count === 1) return `1 ${singular}`;
  return `${count} ${plural}`;
}

function parseUserGpa(input: MatchInput) {
  const candidates = [
    input.user?.gpa,
    input.questionnaireAnswers?.[QUESTIONNAIRE_FIELD_IDS.gpa],
  ];

  for (const value of candidates) {
    const parsed = Number.parseFloat(String(value ?? "").trim());
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 5) {
      return parsed;
    }
  }

  return null;
}

function getUserResidency(input: MatchInput) {
  return normalizeResidencyTag(
    input.user?.residencyType ??
      input.questionnaireAnswers?.[QUESTIONNAIRE_FIELD_IDS.inStateOutOfState]
  );
}

function getProgressReason(progress: OpportunityProgressState | null) {
  if (progress === OPPORTUNITY_PROGRESS_STATES.won) return "Awarded";
  if (progress === OPPORTUNITY_PROGRESS_STATES.expired) return "Expired";
  if (progress === OPPORTUNITY_PROGRESS_STATES.submitted) return "Submitted";
  return "Completed";
}

function getNeedAidSignal(questionnaireAnswers: QuestionnaireAnswers) {
  const rawValue = String(
    questionnaireAnswers?.[QUESTIONNAIRE_FIELD_IDS.costOfAttendance] ?? ""
  )
    .trim()
    .toLowerCase();
  return rawValue.includes("aid") || rawValue.includes("under") || rawValue.includes("20");
}

function getFinancialAidMatchTags(input: MatchInput): OpportunityFinancialAidTag[] {
  const tags: OpportunityFinancialAidTag[] = [];
  if (getNeedAidSignal(input.questionnaireAnswers)) {
    tags.push(
      OPPORTUNITY_FINANCIAL_AID_TAGS.needBased,
      OPPORTUNITY_FINANCIAL_AID_TAGS.lowCost,
      OPPORTUNITY_FINANCIAL_AID_TAGS.pellFriendly
    );
  }
  return uniqueStrings(tags) as OpportunityFinancialAidTag[];
}

function getCommunityMatchTags(input: MatchInput): OpportunityCommunityTag[] {
  const rawLgbtqAnswer = String(
    input.questionnaireAnswers?.[QUESTIONNAIRE_FIELD_IDS.lgbtqCommunity] ?? ""
  )
    .trim()
    .toLowerCase();

  if (rawLgbtqAnswer === "yes") {
    return [OPPORTUNITY_COMMUNITY_TAGS.lgbtq];
  }

  return [];
}

function isDeadlineOpportunityType(type: Opportunity["type"]) {
  return (
    type === OPPORTUNITY_TYPES.collegeDeadline ||
    type === OPPORTUNITY_TYPES.generalDeadline ||
    type === OPPORTUNITY_TYPES.quarterStart ||
    type === OPPORTUNITY_TYPES.quarterEnd
  );
}

function scoreOpportunity(opportunity: Opportunity, input: MatchInput): MatchedOpportunity | null {
  if (opportunity.status === OPPORTUNITY_STATUSES.archived) return null;

  const status = input.statusById[opportunity.opportunityId];
  const progress = resolveOpportunityProgress(opportunity, status ?? null);
  const isDone = isOpportunityDoneForCurrentCycle(opportunity, status ?? null);
  const userMajor = normalizeMajorTag(
    input.user?.major || input.questionnaireAnswers?.[QUESTIONNAIRE_FIELD_IDS.major]
  );
  const userGpa = parseUserGpa(input);
  const userResidency = getUserResidency(input);
  const communityTags = getCommunityMatchTags(input);
  const suggestedMajors = opportunity.matching.suggestedMajors.map(normalizeMajorTag);
  const dueDate = resolveOpportunityDueDate(opportunity);
  const greenRiverEnrollmentBucket =
    getOpportunityGreenRiverEnrollmentCreditBucket(opportunity);
  const transcriptCreditEstimate = getGreenRiverEnrollmentCreditEstimate(
    opportunity,
    input,
    dueDate
  );
  if (
    greenRiverEnrollmentBucket &&
    transcriptCreditEstimate &&
    getGreenRiverEnrollmentCreditBucket(
      transcriptCreditEstimate.estimatedCurrentCreditsTotal
    ) !== greenRiverEnrollmentBucket
  ) {
    return null;
  }
  const dueAt = dueDate ? dueDate.toISOString() : null;

  if (isDone) {
    return {
      ...opportunity,
      computedDueAt: dueAt,
      progress,
      isDone: true,
      matchScore: -1,
      matchReasons: [getProgressReason(progress)],
    };
  }

  const matchReasons: string[] = [];
  let score = 0;

  if (opportunity.eligibility.gpaMin != null) {
    if (userGpa != null && userGpa < opportunity.eligibility.gpaMin) {
      return null;
    }
    if (userGpa != null && userGpa >= opportunity.eligibility.gpaMin) {
      score += 15;
      matchReasons.push(`GPA ${opportunity.eligibility.gpaMin}+ fit`);
    }
  }

  if (opportunity.eligibility.residencyTypes.length) {
    if (
      userResidency &&
      !opportunity.eligibility.residencyTypes.includes(userResidency)
    ) {
      return null;
    }
    if (
      userResidency &&
      opportunity.eligibility.residencyTypes.includes(userResidency)
    ) {
      score += 12;
      matchReasons.push("Residency fit");
    }
  }

  if (opportunity.eligibility.transferOnly) {
    score += 8;
    matchReasons.push("Transfer fit");
  }

  if (opportunity.eligibility.communityTags.length) {
    const hasCommunityMatch = opportunity.eligibility.communityTags.some((tag) =>
      communityTags.includes(tag as OpportunityCommunityTag)
    );
    if (!hasCommunityMatch) {
      return null;
    }
    score += 20;
    if (opportunity.eligibility.communityTags.includes(OPPORTUNITY_COMMUNITY_TAGS.lgbtq)) {
      matchReasons.push("LGBTQ+ scholarship fit");
    } else {
      matchReasons.push("Community eligibility fit");
    }
  }

  if (opportunity.matching.hasToBeMajor) {
    if (!userMajor || !suggestedMajors.includes(userMajor)) {
      return null;
    }
    score += 40;
    matchReasons.push("Required major match");
  } else if (userMajor && suggestedMajors.length && suggestedMajors.includes(userMajor)) {
    score += 25;
    matchReasons.push("Major match");
  }

  const financialAidTags = getFinancialAidMatchTags(input);
  if (
    financialAidTags.some((tag) =>
      opportunity.matching.financialAidTags.includes(tag)
    )
  ) {
    score += 20;
    matchReasons.push("Financial aid fit");
  }

  if (opportunity.requirements.recommendationCountMin > 0) {
    const recommendationLabel =
      opportunity.requirements.recommendationCountMin === 1
        ? "1+ recommendations required"
        : `${opportunity.requirements.recommendationCountMin}+ recommendations required`;
    matchReasons.push(recommendationLabel);
  }

  if (opportunity.requirements.essayCount > 0) {
    matchReasons.push(
      formatRequirementCountLabel(opportunity.requirements.essayCount, "essay")
    );
  }

  if (dueDate) {
    const daysUntilDue = Math.ceil(
      (dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    if (daysUntilDue >= 0 && daysUntilDue <= 14) {
      score += 30;
      matchReasons.push("Due soon");
    } else if (daysUntilDue <= 45) {
      score += 15;
      matchReasons.push("Upcoming deadline");
    }
  }

  if (opportunity.deadline.type === OPPORTUNITY_DEADLINE_TYPES.priority) {
    score += 10;
    matchReasons.push("Priority deadline");
  } else if (
    opportunity.deadline.type === OPPORTUNITY_DEADLINE_TYPES.rolling &&
    !dueDate
  ) {
    score += 5;
    matchReasons.push("Rolling deadline");
  }

  if (isDeadlineOpportunityType(opportunity.type)) {
    score += 10;
  }

  if (greenRiverEnrollmentBucket && transcriptCreditEstimate) {
    score += 12;
    if (transcriptCreditEstimate.usedProjection) {
      matchReasons.push(
        `Estimated credits by enrollment date: ${formatCreditAmount(
          transcriptCreditEstimate.estimatedCurrentCreditsTotal
        )} (${formatCreditAmount(
          transcriptCreditEstimate.earnedCreditsTotal
        )} transcript + ${formatCreditAmount(
          transcriptCreditEstimate.estimatedAdditionalCredits
        )} projected)`
      );
    } else {
      matchReasons.push(
        `Transcript bucket: ${GREEN_RIVER_ENROLLMENT_CREDIT_BUCKET_LABELS[greenRiverEnrollmentBucket]}`
      );
    }
  }

  return {
    ...opportunity,
    computedDueAt: dueAt,
    progress,
    isDone: false,
    matchScore: score,
    matchReasons: uniqueStrings(matchReasons),
  };
}

class OpportunityMatchingService {
  matchOpportunities(opportunities: Opportunity[], input: MatchInput) {
    return (opportunities ?? [])
      .map((opportunity) => scoreOpportunity(opportunity, input))
      .filter((opportunity): opportunity is MatchedOpportunity => !!opportunity)
      .sort((left, right) => {
        if (left.isDone !== right.isDone) return left.isDone ? 1 : -1;
        if (left.matchScore !== right.matchScore) return right.matchScore - left.matchScore;
        return (left.computedDueAt ?? "9999").localeCompare(right.computedDueAt ?? "9999");
      });
  }
}

export const opportunityMatchingService = new OpportunityMatchingService();
