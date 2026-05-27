import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { PageBackButton } from "@/components/ui/PageBackButton";
import { StateCard } from "@/components/ui/StateCard";
import { TouchIconButton } from "@/components/ui/TouchPrimitives";
import { SuggestedScheduleCard } from "@/components/transfer-planner/SuggestedScheduleCard";
import { TranscriptSummaryCard } from "@/components/transfer-planner/TranscriptSummaryCard";
import { useTransferPlannerController } from "@/components/transfer-planner/useTransferPlannerController";
import {
  getPlannerNoDataMessage,
  isOpenAdmissionMajor,
} from "@/components/transfer-planner/transfer-planner-formatters";
import type { TransferPlannerRouteSelection } from "@/components/transfer-planner/transfer-planner-routing";
import { useAppLanguage } from "@/hooks/use-app-language";

export type TransferPlannerPageProps = {
  routeSelection?: TransferPlannerRouteSelection | null;
};

export default function TransferPlannerPage({
  routeSelection = null,
}: TransferPlannerPageProps) {
  const { t } = useAppLanguage();
  const {
    handleGoBack,
    backLabel,
    textClass,
    secondaryTextClass,
    cardBgClass,
    borderClass,
    dropdownSurfaceColor,
    isDesktop,
    shellMaxWidth,
    shellHorizontalPadding,
    scrollContentPadding,
    user,
    selectedCollegeId,
    openSelector,
    isPathwaySelectorOpen,
    handlePlannerTouchStart,
    handlePlannerTouchEnd,
    handlePlannerScrollBeginDrag,
    handleSelectorTouchStartInside,
    handleToggleCollegeSelector,
    handleToggleCampusSelector,
    handleToggleMajorSelector,
    handleTogglePathwaySelector,
    handleDismissCollegeSelector,
    handleDismissCampusSelector,
    handleDismissMajorSelector,
    handleSelectCollege,
    handleSelectCampus,
    handleSelectMajor,
    handleSelectPathwayAndClose,
    handleOpenTranscriptLink,
    isUwPlanner,
    plan,
    selectedGrcTrack,
    selectedGrcTrackRequirementNoun,
    activeTranscriptDocument,
    isAnalyzingTranscript,
    transcriptError,
    studentEvaluationReport,
    studentCourseEvaluations,
    pathwayOptions,
    hasNoDirectMajorEquivalencies,
    selectedCollegeLabel,
    effectiveSelectedCampusId,
    selectedCampusLabel,
    effectiveSelectedMajorId,
    selectedMajorLabel,
    track,
    activeTrackCode,
    activeTrackTitle,
    activeTrackSummary,
    activeTrackOfficialLinkUrl,
    completedCourses,
    transcriptDerivedCompletedCourses,
    shouldUseDetailedCompletedCourses,
    collegeOptions,
    campusOptions,
    majorOptions,
    handlePickTranscript,
    handleRemoveTranscript,
    hasStructuredPlannerData,
    isPlannerComputationLoading,
    suggestedQuarterPlan,
    plannerPathKey,
    activeDegreeTitle,
    onlyUwEssentialClasses,
    handleToggleOnlyUwEssentialClasses,
    shouldShowUwOnlyToggle,
    allowSummerClasses,
    handleToggleAllowSummerClasses,
    allowStemPrepClasses,
    handleToggleAllowStemPrepClasses,
    currentPlannedCourseSet,
    handleToggleCurrentCourse,
    selectedRequirementOptionIdsByGroup,
    handleSelectRequirementOption,
    handleReportBug,
    demoReview,
    plannerHeroContent,
  } = useTransferPlannerController({ routeSelection });

  if (!user) {
    return (
      <ScreenBackground includeTopInset includeBottomInset={false}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <StateCard
            variant="empty"
            title={t("transferPlanner.profileNeededTitle")}
            message={t("transferPlanner.profileNeededMessage")}
          />
        </View>
      </ScreenBackground>
    );
  }

  if (isUwPlanner && !plan) {
    return (
      <ScreenBackground includeTopInset includeBottomInset={false}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <StateCard
            variant="empty"
            title={t("transferPlanner.noPlannerDataTitle")}
            message={getPlannerNoDataMessage(selectedCollegeId, t)}
          />
        </View>
      </ScreenBackground>
    );
  }

  if (!isUwPlanner && !selectedGrcTrack) {
    return (
      <ScreenBackground includeTopInset includeBottomInset={false}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <StateCard
            variant="empty"
            title={t("transferPlanner.noPlannerDataTitle")}
            message={getPlannerNoDataMessage(selectedCollegeId, t)}
          />
        </View>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground includeTopInset includeBottomInset={false}>
        <ScrollView
          contentContainerStyle={{
            paddingBottom: scrollContentPadding.paddingBottom,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          onTouchStart={handlePlannerTouchStart}
          onTouchEnd={handlePlannerTouchEnd}
          onScrollBeginDrag={handlePlannerScrollBeginDrag}
          scrollEnabled
        >
        <View
          style={{
            alignSelf: "center",
            width: "100%",
            maxWidth: shellMaxWidth,
            paddingHorizontal: shellHorizontalPadding,
            paddingTop: scrollContentPadding.paddingTop + 12,
            gap: 24,
            position: "relative",
          }}
        >
          <View className="gap-4">
            <PageBackButton onPress={handleGoBack} label={backLabel} textClassName={secondaryTextClass} />

            <View className="flex-row items-start">
              <View className="w-12 h-12 rounded-2xl bg-emerald-500/10 items-center justify-center mr-3">
                <Ionicons name="trail-sign-outline" size={22} color="#008f4e" />
              </View>
              <View className="flex-1">
                <Text className={`${textClass} text-2xl font-semibold`}>
                  {plannerHeroContent.title}
                </Text>
                <Text className={`${secondaryTextClass} text-sm mt-1`}>
                  {plannerHeroContent.description}
                </Text>
              </View>
            </View>
          </View>

          <TranscriptSummaryCard
            collegeId={selectedCollegeId}
            transcriptDocument={activeTranscriptDocument}
            isAnalyzing={isAnalyzingTranscript}
            errorMessage={transcriptError}
            studentEvaluationReport={studentEvaluationReport}
            studentCourseEvaluations={studentCourseEvaluations}
            plan={plan}
            pathwayOptions={pathwayOptions}
            selectedPathwayLabel={plan?.selectedPathwayLabel ?? null}
            hasNoDirectMajorEquivalencies={hasNoDirectMajorEquivalencies}
            demoReview={demoReview}
            selectedCollegeId={selectedCollegeId}
            selectedCollegeLabel={selectedCollegeLabel}
            selectedCampusId={effectiveSelectedCampusId}
            selectedCampusLabel={selectedCampusLabel}
            selectedMajorId={effectiveSelectedMajorId}
            selectedMajorLabel={selectedMajorLabel}
            track={track}
            trackCode={activeTrackCode}
            trackTitle={activeTrackTitle}
            trackSummary={activeTrackSummary}
            trackOfficialLinkUrl={activeTrackOfficialLinkUrl}
            completedCourses={completedCourses}
            transcriptDerivedCompletedCourses={transcriptDerivedCompletedCourses}
            hasTranscriptDerivedCreditSource={shouldUseDetailedCompletedCourses}
            openSelector={openSelector}
            collegeOptions={collegeOptions}
            campusOptions={campusOptions}
            majorOptions={majorOptions}
            isPathwaySelectorOpen={isPathwaySelectorOpen}
            onToggleCollege={handleToggleCollegeSelector}
            onToggleCampus={handleToggleCampusSelector}
            onToggleMajor={handleToggleMajorSelector}
            onTogglePathway={handleTogglePathwaySelector}
            onSelectorTouchStartInside={handleSelectorTouchStartInside}
            onDismissCampus={handleDismissCampusSelector}
            onDismissMajor={handleDismissMajorSelector}
            onDismissCollege={handleDismissCollegeSelector}
            onSelectCollege={handleSelectCollege}
            onSelectCampus={handleSelectCampus}
            onSelectMajor={handleSelectMajor}
            onSelectPathway={handleSelectPathwayAndClose}
            onUpload={handlePickTranscript}
            onOpenTranscriptLink={handleOpenTranscriptLink}
            onRemoveTranscript={handleRemoveTranscript}
            isDesktop={isDesktop}
            textClass={textClass}
            secondaryTextClass={secondaryTextClass}
            cardClass={cardBgClass}
            borderClass={borderClass}
            dropdownBackgroundColor={dropdownSurfaceColor}
          />

          {isUwPlanner && hasNoDirectMajorEquivalencies ? (
            <View className={`${cardBgClass} border rounded-[28px] p-5`}>
              <Text className={`${textClass} text-lg font-semibold`}>
                {t("transferPlanner.noClassEquivalenciesFor", { major: plan?.title ?? selectedMajorLabel })}
              </Text>
              <Text className={`${secondaryTextClass} text-sm mt-2`}>
                {t("transferPlanner.noClassEquivalenciesBody")}
              </Text>
              {plan && isOpenAdmissionMajor(plan) ? (
                <Text className={`${secondaryTextClass} text-sm mt-2`}>
                  {t("transferPlanner.openMajorBody", { major: plan.title })}
                </Text>
              ) : null}
            </View>
          ) : null}

          {!hasStructuredPlannerData && !(isUwPlanner && hasNoDirectMajorEquivalencies) ? (
            <View className={`${cardBgClass} border rounded-[28px] p-5`}>
              <Text className={`${textClass} text-lg font-semibold`}>
                {t("transferPlanner.quarterPlanNoteTitle")}
              </Text>
              <Text className={`${secondaryTextClass} text-sm mt-1`}>
                {isUwPlanner
                  ? t("transferPlanner.quarterPlanNoteUw")
                  : t("transferPlanner.quarterPlanNoteGrc", { noun: selectedGrcTrackRequirementNoun })}
              </Text>
            </View>
          ) : null}

          {hasStructuredPlannerData ? (
            <>
              {isPlannerComputationLoading ? (
                <View className={`${cardBgClass} border rounded-[28px] p-5`}>
                  <View className="flex-row items-center">
                    <ActivityIndicator color="#008f4e" />
                    <View className="ml-3 flex-1">
                      <Text className={`${textClass} text-lg font-semibold`}>
                        {t("transferPlanner.buildingPlannerTitle")}
                      </Text>
                      <Text className={`${secondaryTextClass} text-sm mt-1`}>
                        {t("transferPlanner.buildingPlannerBody")}
                      </Text>
                    </View>
                  </View>
                </View>
              ) : (
                <SuggestedScheduleCard
                  key={plannerPathKey}
                  quarters={suggestedQuarterPlan}
                  plan={isUwPlanner ? plan : null}
                  collegeId={selectedCollegeId}
                  plannerPathKey={plannerPathKey}
                  degreeTitle={activeDegreeTitle}
                  grcTrack={track}
                  campusLabel={selectedCampusLabel}
                  selectedCampusId={isUwPlanner ? plan?.campusId ?? null : null}
                  selectedMajorId={isUwPlanner ? plan?.id ?? null : null}
                  selectedPathwayId={isUwPlanner ? plan?.selectedPathwayId ?? null : null}
                  onlyUwEssentialClasses={onlyUwEssentialClasses}
                  showOnlyUwEssentialClassesToggle={shouldShowUwOnlyToggle}
                  onToggleOnlyUwEssentialClasses={handleToggleOnlyUwEssentialClasses}
                  allowSummerClasses={allowSummerClasses}
                  onToggleAllowSummerClasses={handleToggleAllowSummerClasses}
                  allowStemPrepClasses={allowStemPrepClasses}
                  onToggleAllowStemPrepClasses={handleToggleAllowStemPrepClasses}
                  completedCourses={completedCourses}
                  currentCourseSelections={currentPlannedCourseSet}
                  onToggleCurrentCourse={handleToggleCurrentCourse}
                  selectedRequirementOptionIdsByGroup={selectedRequirementOptionIdsByGroup}
                  onSelectRequirementOption={handleSelectRequirementOption}
                  textClass={textClass}
                  secondaryTextClass={secondaryTextClass}
                  cardClass={cardBgClass}
                  borderClass={borderClass}
                />
              )}
            </>
          ) : null}

          <View className="items-center pb-2">
            <TouchIconButton
              onPress={() => {
                void handleReportBug();
              }}
              accessibilityRole="link"
              accessibilityLabel={t("transferPlanner.reportBugLabel")}
              className="flex-row items-center justify-center px-3"
            >
              <Text className="text-sm font-semibold text-emerald-600 underline">
                {t("transferPlanner.reportBugLabel")}
              </Text>
            </TouchIconButton>
          </View>

        </View>
      </ScrollView>
    </ScreenBackground>
  );
}
