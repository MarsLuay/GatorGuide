import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Text, View } from "react-native";

import { TouchOptionRow } from "@/components/ui/TouchPrimitives";
import { ROUTES } from "@/constants/routes";
import type {
  TransferPlannerResolvedMajorPlan,
  TransferPlannerStudentCourseEvaluation,
} from "@/constants/transfer-planner-source/student-runtime";
import { useAppLanguage } from "@/hooks/use-app-language";
import type { TransferPlannerStudentEvaluationReport } from "@/services/planning/transfer-planner.service";

import {
  buildRequirementCreditTotalsByTag,
  getEvaluationOutcomeBadgeClass,
  getEvaluationOutcomeBadgeLabel,
  getEvaluationOutcomeTextClass,
  getEvaluationRequirementCreditMessageParts,
  normalizeRequirementTag,
  shouldShowRequirementCreditMessage,
} from "./transfer-planner-major-specifics-formatters";
import { formatSuggestedScheduleCreditNumber } from "./transfer-planner-suggested-schedule";

export function formatTranscriptEvaluationCreditRange(creditMin: number, creditMax: number) {
  if (creditMin === creditMax) {
    return formatSuggestedScheduleCreditNumber(creditMin);
  }

  return `${formatSuggestedScheduleCreditNumber(creditMin)}-${formatSuggestedScheduleCreditNumber(
    creditMax
  )}`;
}

export function TranscriptEvaluationReportCard({
  report,
  evaluations,
  plan,
  textClass,
  secondaryTextClass,
  cardClass,
  borderClass,
  embedded = false,
}: {
  report: TransferPlannerStudentEvaluationReport;
  evaluations: TransferPlannerStudentCourseEvaluation[];
  plan: TransferPlannerResolvedMajorPlan;
  textClass: string;
  secondaryTextClass: string;
  cardClass: string;
  borderClass: string;
  embedded?: boolean;
}) {
  const router = useRouter();
  const { t } = useAppLanguage();
  const studentFacingEvaluations = evaluations.filter((entry) => entry.studentFacing);
  const creditTotalsByTag = useMemo(
    () => buildRequirementCreditTotalsByTag(plan, studentFacingEvaluations),
    [plan, studentFacingEvaluations]
  );
  const completedCreditsByTag = useMemo(() => {
    const totals = new Map<string, number>();

    for (const evaluation of studentFacingEvaluations) {
      if (!shouldShowRequirementCreditMessage(evaluation)) continue;

      const creditAmount = evaluation.sourceCreditAmount ?? 5;
      const normalizedTags = Array.from(
        new Set(
          evaluation.targetRequirementTags
            .map((tag) => normalizeRequirementTag(tag))
            .filter(Boolean)
        )
      );

      for (const tag of normalizedTags) {
        totals.set(tag, (totals.get(tag) ?? 0) + creditAmount);
      }
    }

    return totals;
  }, [studentFacingEvaluations]);
  const remainingDirectTransferCredits = formatTranscriptEvaluationCreditRange(
    report.remainingDirectTransferCreditMin,
    report.remainingDirectTransferCreditMax
  );
  const completedDirectTransferCredits = formatSuggestedScheduleCreditNumber(
    report.completedDirectTransferCredits
  );
  const [isEvaluationOpen, setIsEvaluationOpen] = useState(false);

  if (!report.completedCourseCount) {
    return null;
  }

  const containerClass = embedded
    ? `border ${borderClass} rounded-2xl px-4 py-4 mt-4`
    : `${cardClass} border rounded-[28px] p-5`;

  return (
    <View className={containerClass}>
      <TouchOptionRow
        onPress={() => setIsEvaluationOpen((currentValue) => !currentValue)}
        expanded={isEvaluationOpen}
        accessibilityLabel={t("transferPlanner.transcriptEvaluation")}
      >
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 min-w-0">
            <Text className={`${textClass} text-lg font-semibold`}>
              {t("transferPlanner.transcriptEvaluation")}
            </Text>
            <Text className={`${secondaryTextClass} text-sm mt-1`}>
              {t("transferPlanner.transcriptEvaluationDescription")}
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <View className="px-3 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/10">
              <Text className="text-emerald-500 text-xs font-semibold">
                {t("transferPlanner.ruleCount", {
                  count: report.officialRuleIds.length,
                  noun:
                    report.officialRuleIds.length === 1
                      ? t("transferPlanner.ruleSingular")
                      : t("transferPlanner.rulePlural"),
                })}
              </Text>
            </View>
            <Ionicons
              name={isEvaluationOpen ? "chevron-up" : "chevron-down"}
              size={20}
              color="#9CA3AF"
            />
          </View>
        </View>
      </TouchOptionRow>

      {isEvaluationOpen ? (
        <>
          <View className={`border ${borderClass} rounded-2xl px-4 py-4 mt-4`}>
            <Text className={`${textClass} text-base font-semibold`}>
              {t("transferPlanner.directTransferCreditsSummary", {
                directTransferCredits: remainingDirectTransferCredits,
                campus: report.campusLabel,
                completedCredits: completedDirectTransferCredits,
              })}
            </Text>
          </View>

          {studentFacingEvaluations.length ? (
            <View className="gap-3 mt-4">
              {studentFacingEvaluations.map((evaluation) => {
                const requirementCreditMessage = getEvaluationRequirementCreditMessageParts({
                  evaluation,
                  totalsByTag: creditTotalsByTag,
                  completedByTag: completedCreditsByTag,
                  campusId: plan.campusId,
                });

                return (
                  <View
                    key={evaluation.id}
                    className={`border ${borderClass} rounded-2xl px-4 py-4`}
                  >
                    <View className="flex-row items-start justify-between gap-3">
                      <View className="flex-1 min-w-0">
                        <Text className={`${textClass} font-semibold`}>
                          {evaluation.courseCode}
                        </Text>
                        <Text className={`${secondaryTextClass} text-xs mt-1`} numberOfLines={2}>
                          {evaluation.targetOutcome ??
                            t("transferPlanner.noSourceBackedTargetOutcome")}
                        </Text>
                      </View>
                      <View
                        className={`px-3 py-1 rounded-full border ${getEvaluationOutcomeBadgeClass(
                          evaluation.outcome
                        )}`}
                      >
                        <Text
                          className={`text-xs font-semibold ${getEvaluationOutcomeTextClass(
                            evaluation.outcome,
                            textClass
                          )}`}
                        >
                          {getEvaluationOutcomeBadgeLabel(evaluation.outcome, t)}
                        </Text>
                      </View>
                    </View>

                    {evaluation.missingSourceCourseCodes.length ? (
                      <Text className={`${secondaryTextClass} text-xs mt-2`}>
                        {t("transferPlanner.missingForStrongestSequence", {
                          courses: evaluation.missingSourceCourseCodes.join(", "),
                        })}
                      </Text>
                    ) : null}

                    {evaluation.automaticGuidanceSummary ? (
                      <Text className={`${secondaryTextClass} text-xs mt-2`}>
                        {evaluation.automaticGuidanceSummary}
                      </Text>
                    ) : null}

                    {requirementCreditMessage ? (
                      <Text className={`${secondaryTextClass} text-xs mt-2`}>
                        {requirementCreditMessage.prefix}
                        <Text
                          className="text-emerald-500 underline"
                          onPress={() =>
                            router.push({
                              pathname: ROUTES.transferEquivalencies,
                              params: {
                                tag: requirementCreditMessage.normalizedTag,
                                campusId: requirementCreditMessage.campusId,
                                majorId: plan.id,
                                ...(plan.selectedPathwayId
                                  ? { pathwayId: plan.selectedPathwayId }
                                  : {}),
                                returnTo: ROUTES.transferPlanner,
                              },
                            })
                          }
                        >
                          {requirementCreditMessage.clickableLabel}
                        </Text>
                        {requirementCreditMessage.suffix}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : null}

          {report.hiddenEvaluationCount ? (
            <View className="mt-4 px-4 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
              <Text className="text-amber-500 text-sm font-semibold">
                {t("transferPlanner.hiddenSourceGapEvaluation")}
              </Text>
              <Text className={`${secondaryTextClass} text-xs mt-1`}>
                {t("transferPlanner.hiddenEvaluationCount", {
                  count: report.hiddenEvaluationCount,
                  evaluationNoun:
                    report.hiddenEvaluationCount === 1
                      ? t("transferPlanner.evaluationSingular")
                      : t("transferPlanner.evaluationPlural"),
                })}
              </Text>
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
