import type { User, QuestionnaireAnswers } from "@/hooks/use-app-data";
import {
  type Opportunity,
  type UserOpportunityStatus,
  type OpportunityFinancialAidTag,
  isOpportunityDoneForCurrentCycle,
  normalizeMajorTag,
  OPPORTUNITY_FINANCIAL_AID_TAGS,
  OPPORTUNITY_STATUSES,
  resolveOpportunityDueDate,
} from "@/constants/opportunities";
import { QUESTIONNAIRE_FIELD_IDS } from "@/constants/schema";

export type MatchedOpportunity = Opportunity & {
  computedDueAt: string | null;
  isDone: boolean;
  matchScore: number;
  matchReasons: string[];
};

type MatchInput = {
  user: User | null;
  questionnaireAnswers: QuestionnaireAnswers;
  statusById: Record<string, UserOpportunityStatus | undefined>;
};

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
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

function scoreOpportunity(opportunity: Opportunity, input: MatchInput): MatchedOpportunity | null {
  if (opportunity.status === OPPORTUNITY_STATUSES.archived) return null;

  const status = input.statusById[opportunity.opportunityId];
  const isDone = isOpportunityDoneForCurrentCycle(opportunity, status ?? null);
  const userMajor = normalizeMajorTag(input.user?.major);
  const suggestedMajors = opportunity.matching.suggestedMajors.map(normalizeMajorTag);
  const dueDate = resolveOpportunityDueDate(opportunity);
  const dueAt = dueDate ? dueDate.toISOString() : null;

  if (isDone) {
    return {
      ...opportunity,
      computedDueAt: dueAt,
      isDone: true,
      matchScore: -1,
      matchReasons: ["Completed"],
    };
  }

  const matchReasons: string[] = [];
  let score = 0;

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

  if (opportunity.requirements.needsRecommendations) {
    matchReasons.push("Needs recommendations");
  }

  if (opportunity.requirements.essayCount > 0) {
    matchReasons.push(
      `${opportunity.requirements.essayCount} essay${
        opportunity.requirements.essayCount === 1 ? "" : "s"
      }`
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

  if (opportunity.type === "college_deadline") {
    score += 10;
  }

  return {
    ...opportunity,
    computedDueAt: dueAt,
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
