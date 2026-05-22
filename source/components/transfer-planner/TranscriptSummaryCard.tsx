import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { AnimatedChipPressable } from "@/components/ui/AnimatedPressables";
import {
  SearchableSelect,
  type SelectorOverlayStrategy,
} from "@/components/ui/SearchableSelect";
import {
  TouchIconButton,
  TouchOptionRow,
} from "@/components/ui/TouchPrimitives";
import { ROUTES } from "@/constants/routes";
import {
  type TransferPlannerMajorPathway,
  type TransferPlannerResolvedMajorPlan,
  type TransferPlannerStudentCourseEvaluation,
  type TransferPlannerTrack,
} from "@/constants/transfer-planner-source/student-runtime";
import {
  type TransferPlannerStudentEvaluationReport,
  type TranscriptCourseEntry,
} from "@/services/planning/transfer-planner.service";
import { useAppLanguage } from "@/hooks/use-app-language";

import { MajorSpecificsSection } from "./MajorSpecificsSection";
import {
  buildCopyOnlyMatchedTrackDebugText,
  buildMajorSpecificsGrcGeneralEducationCreditLines,
  buildMajorSpecificsGrcRequiredMajorCourseLines,
  buildRequirementCreditTotalsByTag,
  COPY_ONLY_OPTION_STATUS_TEXT_STYLE,
  CTCLINK_UNOFFICIAL_TRANSCRIPT_URL,
  getAutoTrackSummaryText,
  getEvaluationOutcomeBadgeClass,
  getEvaluationOutcomeBadgeLabel,
  getEvaluationOutcomeTextClass,
  getEvaluationRequirementCreditMessageParts,
  getGrcTrackClassesLabelSuffix,
  getGrcTrackRequirementNoun,
  getGrcTrackSpecificsTitle,
  getPlannerMajorSearchPlaceholder,
  getPlannerSelectionHelperText,
  normalizeRequirementTag,
  openExternalLink,
  shouldShowRequirementCreditMessage,
} from "./transfer-planner-formatters";
import type {
  PlannerCampusSelectionId,
  PlannerCollegeId,
  PlannerSelectorKey,
  TranscriptDocument,
} from "./transfer-planner-storage";

function SelectorField({
  label,
  value,
  helper,
  open,
  onToggle,
  onDismiss,
  options,
  onSelect,
  selectedOptionId,
  hideSelectedOptionWhenOpen,
  searchable,
  searchPlaceholder,
  textClass,
  secondaryTextClass,
  borderClass,
  dropdownBackgroundColor,
  onTouchStartInside,
  overlayStrategy = "inline",
}: {
  label: string;
  value: string;
  helper: string;
  open: boolean;
  onToggle: () => void;
  onDismiss?: () => void;
  options: { id: string; label: string; description?: string }[];
  onSelect: (id: string) => void;
  selectedOptionId?: string | null;
  hideSelectedOptionWhenOpen?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  textClass: string;
  secondaryTextClass: string;
  borderClass: string;
  dropdownBackgroundColor: string;
  onTouchStartInside?: () => void;
  overlayStrategy?: SelectorOverlayStrategy;
}) {
  return (
    <View className="relative" onTouchStart={onTouchStartInside}>
      <Text className={`${textClass} text-base font-semibold`}>{label}</Text>
      <Text className={`${secondaryTextClass} text-sm mt-1`}>{helper}</Text>
      <View className="mt-4">
        <SearchableSelect
          value={value}
          open={open}
          onToggle={onToggle}
          onDismiss={onDismiss}
          options={options}
          onSelect={onSelect}
          selectedOptionId={selectedOptionId}
          hideSelectedOptionWhenOpen={hideSelectedOptionWhenOpen}
          searchable={searchable}
          searchPlaceholder={searchPlaceholder ?? `Search ${label.toLowerCase()}`}
          textClass={textClass}
          secondaryTextClass={secondaryTextClass}
          borderClass={borderClass}
          dropdownBackgroundColor={dropdownBackgroundColor}
          onTouchStartInside={onTouchStartInside}
          overlayStrategy={overlayStrategy}
        />
      </View>
    </View>
  );
}

function PlannerSelectionFields({
  collegeId,
  selectedCollegeId,
  selectedCollegeLabel,
  selectedCampusId,
  selectedCampusLabel,
  selectedMajorId,
  selectedMajorLabel,
  openSelector,
  collegeOptions,
  campusOptions,
  majorOptions,
  onToggleCollege,
  onToggleCampus,
  onToggleMajor,
  onDismissCollege,
  onDismissCampus,
  onDismissMajor,
  onSelectCollege,
  onSelectCampus,
  onSelectMajor,
  onSelectorTouchStartInside,
  isDesktop,
  textClass,
  secondaryTextClass,
  borderClass,
  dropdownBackgroundColor,
}: {
  collegeId: PlannerCollegeId;
  selectedCollegeId: PlannerCollegeId;
  selectedCollegeLabel: string;
  selectedCampusId: PlannerCampusSelectionId;
  selectedCampusLabel: string;
  selectedMajorId: string;
  selectedMajorLabel: string;
  openSelector: PlannerSelectorKey;
  collegeOptions: { id: string; label: string; description?: string }[];
  campusOptions: { id: string; label: string; description?: string }[];
  majorOptions: { id: string; label: string; description?: string }[];
  onToggleCollege: () => void;
  onToggleCampus: () => void;
  onToggleMajor: () => void;
  onDismissCollege: () => void;
  onDismissCampus: () => void;
  onDismissMajor: () => void;
  onSelectCollege: (id: string) => void;
  onSelectCampus: (id: string) => void;
  onSelectMajor: (id: string) => void;
  onSelectorTouchStartInside: () => void;
  isDesktop: boolean;
  textClass: string;
  secondaryTextClass: string;
  borderClass: string;
  dropdownBackgroundColor: string;
}) {
  const { t } = useAppLanguage();
  const getFieldContainerStyle = (
    selectorKey: Exclude<PlannerSelectorKey, null>,
    shouldElevateInlineOverlay = false
  ) => {
    const baseStyle = isDesktop ? { flex: 1, minWidth: 0 } : {};

    if (!shouldElevateInlineOverlay || openSelector !== selectorKey) {
      return Object.keys(baseStyle).length ? baseStyle : undefined;
    }

    return {
      ...baseStyle,
      position: "relative" as const,
      zIndex: 130,
      elevation: 130,
    };
  };

  return (
    <View
      className="mt-4"
      style={
        isDesktop ? { flexDirection: "row", alignItems: "flex-start", gap: 16 } : { gap: 16 }
      }
    >
      <View style={getFieldContainerStyle("college", true)}>
        <SelectorField
          label={t("transferPlanner.college")}
          value={selectedCollegeLabel}
          helper={getPlannerSelectionHelperText(collegeId, "college", t)}
          open={openSelector === "college"}
          onToggle={onToggleCollege}
          onTouchStartInside={onSelectorTouchStartInside}
          onDismiss={onDismissCollege}
          options={collegeOptions}
          onSelect={onSelectCollege}
          selectedOptionId={selectedCollegeId}
          hideSelectedOptionWhenOpen
          textClass={textClass}
          secondaryTextClass={secondaryTextClass}
          borderClass={borderClass}
          dropdownBackgroundColor={dropdownBackgroundColor}
          overlayStrategy="inline-isolated"
        />
      </View>

      <View style={getFieldContainerStyle("campus")}>
        <SelectorField
          label={t("transferPlanner.campus")}
          value={selectedCampusLabel}
          helper={getPlannerSelectionHelperText(collegeId, "campus", t)}
          open={openSelector === "campus"}
          onToggle={onToggleCampus}
          onTouchStartInside={onSelectorTouchStartInside}
          onDismiss={onDismissCampus}
          options={campusOptions}
          onSelect={onSelectCampus}
          selectedOptionId={selectedCampusId}
          hideSelectedOptionWhenOpen
          textClass={textClass}
          secondaryTextClass={secondaryTextClass}
          borderClass={borderClass}
          dropdownBackgroundColor={dropdownBackgroundColor}
          overlayStrategy="modal"
        />
      </View>

      <View style={getFieldContainerStyle("major")}>
        <SelectorField
          label={t("transferPlanner.major")}
          value={selectedMajorLabel}
          helper={getPlannerSelectionHelperText(collegeId, "major", t)}
          open={openSelector === "major"}
          onToggle={onToggleMajor}
          onTouchStartInside={onSelectorTouchStartInside}
          onDismiss={onDismissMajor}
          options={majorOptions}
          onSelect={onSelectMajor}
          selectedOptionId={selectedMajorId}
          searchable
          searchPlaceholder={getPlannerMajorSearchPlaceholder(collegeId, t)}
          textClass={textClass}
          secondaryTextClass={secondaryTextClass}
          borderClass={borderClass}
          dropdownBackgroundColor={dropdownBackgroundColor}
        />
      </View>
    </View>
  );
}

function PlannerTrackOverviewCard({
  collegeId,
  headerTrackId,
  explanationTrackId,
  trackCode,
  trackTitle,
  trackSummary,
  trackOfficialLinkUrl,
  hasNoDirectMajorEquivalencies,
  textClass,
  secondaryTextClass,
  borderClass,
}: {
  collegeId: PlannerCollegeId;
  headerTrackId: string | null;
  explanationTrackId: string | null;
  trackCode: string | null;
  trackTitle: string;
  trackSummary: string;
  trackOfficialLinkUrl: string | null;
  hasNoDirectMajorEquivalencies: boolean;
  textClass: string;
  secondaryTextClass: string;
  borderClass: string;
}) {
  const { t } = useAppLanguage();
  const visibleTrackSummary = getAutoTrackSummaryText(trackSummary);
  const matchedTrackDebugText = buildCopyOnlyMatchedTrackDebugText({
    headerTrackId,
    explanationTrackId,
    trackSummary,
  });
  const shouldShowBestTrackCard =
    collegeId === "uw" ? Boolean(trackCode) && !hasNoDirectMajorEquivalencies : Boolean(trackTitle);
  const headingText = trackCode ? `${trackCode} | ${trackTitle}` : trackTitle;

  if (!shouldShowBestTrackCard) {
    return null;
  }

  return (
    <View className={`border ${borderClass} rounded-2xl px-4 py-4 mt-4`}>
      <Text className={`${textClass} text-base font-semibold`}>
        {collegeId === "grc"
          ? t("transferPlanner.selectedGreenRiverProgramPath")
          : t("transferPlanner.bestGreenRiverPath")}
      </Text>
      <Text className={`${secondaryTextClass} text-sm mt-1`}>
        {collegeId === "grc"
          ? t("transferPlanner.selectedGreenRiverProgramPathDescription")
          : t("transferPlanner.bestGreenRiverPathDescription")}
      </Text>

      <View className={`mt-4 border ${borderClass} rounded-2xl px-4 py-4`}>
        {trackOfficialLinkUrl ? (
          <TouchIconButton
            onPress={() => void openExternalLink(trackOfficialLinkUrl)}
            accessibilityRole="link"
            accessibilityLabel={t("general.openNamed", { name: headingText })}
            className="self-start"
          >
            <Text className="text-emerald-500 underline font-semibold">{headingText}</Text>
          </TouchIconButton>
        ) : (
          <Text className={`${textClass} font-semibold`}>{headingText}</Text>
        )}
        {visibleTrackSummary ? (
          <Text className={`${secondaryTextClass} text-sm mt-2`}>{visibleTrackSummary}</Text>
        ) : null}
        <Text
          selectable
          style={COPY_ONLY_OPTION_STATUS_TEXT_STYLE}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {matchedTrackDebugText}
        </Text>
        {/* Official program map link removed per request */}
      </View>
    </View>
  );
}

function GrcDegreeSpecificsSection({
  track,
  completedCourses,
  textClass,
  secondaryTextClass,
  borderClass,
}: {
  track: TransferPlannerTrack | null;
  completedCourses: TranscriptCourseEntry[];
  textClass: string;
  secondaryTextClass: string;
  borderClass: string;
}) {
  const { t } = useAppLanguage();
  const [isReferenceOpen, setIsReferenceOpen] = useState(false);
  const [isGrcClassesOpen, setIsGrcClassesOpen] = useState(false);
  const grcGeneralEducationCreditLines = useMemo(
    () =>
      isReferenceOpen && isGrcClassesOpen
        ? buildMajorSpecificsGrcGeneralEducationCreditLines({
            plan: null,
            track,
            completedCourses,
            t,
          })
        : [],
    [completedCourses, isGrcClassesOpen, isReferenceOpen, t, track]
  );
  const grcRequiredMajorCourseLines = useMemo(
    () =>
      isReferenceOpen && isGrcClassesOpen
        ? buildMajorSpecificsGrcRequiredMajorCourseLines({
            plan: null,
            track,
            completedCourses,
          })
        : [],
    [completedCourses, isGrcClassesOpen, isReferenceOpen, track]
  );
  const isGrcDegree = getGrcTrackRequirementNoun(track) === "degree";
  const grcTrackRequirementNoun = getGrcTrackRequirementNoun(track, t);
  const grcSpecificsTitle = getGrcTrackSpecificsTitle(track, t);
  const grcClassesLabelSuffix = getGrcTrackClassesLabelSuffix(track, t);
  const grcTrackTitle = String(track?.title ?? "").trim() || t("transferPlanner.selectedGrcProgram");
  const grcTrackDescription = track
    ? t("transferPlanner.grcTrackProgramDescription", {
        title: grcTrackTitle,
        noun: grcTrackRequirementNoun,
      })
    : t("transferPlanner.grcClassListForProgram");
  const grcRequiredMajorCourseFallbackText =
    isGrcDegree
      ? t("transferPlanner.noGrcDegreeMajorCourseList")
      : t("transferPlanner.noGrcProgramMajorCourseList");

  if (!track) {
    return null;
  }

  return (
    <View className={`border ${borderClass} rounded-2xl px-4 py-4 mt-4`}>
      <TouchOptionRow
        onPress={() => setIsReferenceOpen((currentValue) => !currentValue)}
        expanded={isReferenceOpen}
        accessibilityLabel={grcSpecificsTitle}
      >
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 min-w-0">
            <Text className={`${textClass} text-lg font-semibold`}>{grcSpecificsTitle}</Text>
            <Text className={`${secondaryTextClass} text-sm mt-1`}>
              {t("transferPlanner.grcTrackedRequirementsSummary", {
                noun: grcTrackRequirementNoun,
              })}
            </Text>
          </View>
          <Ionicons
            name={isReferenceOpen ? "chevron-up" : "chevron-down"}
            size={20}
            color="#9CA3AF"
          />
        </View>
      </TouchOptionRow>

      {isReferenceOpen ? (
        <View className="mt-5 gap-4">
          <View className={`border ${borderClass} rounded-2xl px-4 py-4`}>
            <TouchOptionRow
              onPress={() => setIsGrcClassesOpen((currentValue) => !currentValue)}
              expanded={isGrcClassesOpen}
              accessibilityLabel={`GRC ${grcTrackTitle} ${grcClassesLabelSuffix}`}
            >
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1 min-w-0">
                  <Text className={`${textClass} text-base font-semibold`}>
                    {`GRC ${grcTrackTitle} ${grcClassesLabelSuffix}`}
                  </Text>
                  <Text className={`${secondaryTextClass} text-sm mt-1`}>
                    {grcTrackDescription}
                  </Text>
                </View>
                <Ionicons
                  name={isGrcClassesOpen ? "chevron-up" : "chevron-down"}
                  size={20}
                  color="#9CA3AF"
                />
              </View>
            </TouchOptionRow>

            {isGrcClassesOpen ? (
              <View className="mt-4 gap-4">
                <View>
                  <Text className={`${textClass} text-sm font-semibold`}>
                    {t("transferPlanner.genEdCourses")}
                  </Text>
                  <View className="mt-2 gap-2">
                    {grcGeneralEducationCreditLines.map((entry) => (
                      <Text key={entry.id} className={`${secondaryTextClass} text-sm`}>
                        {`${entry.label}: ${t("transferPlanner.creditsCount", {
                          count: entry.credits,
                        })}`}
                      </Text>
                    ))}
                  </View>
                </View>

                <View>
                  <Text className={`${textClass} text-sm font-semibold`}>
                    {t("transferPlanner.requiredMajorCourses")}
                  </Text>
                  {grcRequiredMajorCourseLines.length ? (
                    <View className="mt-2 gap-2">
                      {grcRequiredMajorCourseLines.map((entry) => (
                        <View
                          key={entry.id}
                          className="px-3 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20"
                        >
                          <Text className="text-emerald-500 text-sm">{entry.text}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text className={`${secondaryTextClass} text-sm mt-2`}>
                      {grcRequiredMajorCourseFallbackText}
                    </Text>
                  )}
                </View>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

export function TranscriptSummaryCard({
  collegeId,
  transcriptDocument,
  isAnalyzing,
  errorMessage,
  studentEvaluationReport,
  studentCourseEvaluations,
  plan,
  pathwayOptions,
  selectedPathwayLabel,
  hasNoDirectMajorEquivalencies,
  selectedCollegeId,
  selectedCollegeLabel,
  selectedCampusId,
  selectedCampusLabel,
  selectedMajorId,
  selectedMajorLabel,
  track,
  trackCode,
  trackTitle,
  trackSummary,
  trackOfficialLinkUrl,
  completedCourses,
  transcriptDerivedCompletedCourses,
  hasTranscriptDerivedCreditSource,
  openSelector,
  collegeOptions,
  campusOptions,
  majorOptions,
  isPathwaySelectorOpen,
  onToggleCollege,
  onToggleCampus,
  onToggleMajor,
  onTogglePathway,
  onSelectorTouchStartInside,
  onDismissCollege,
  onDismissCampus,
  onDismissMajor,
  onSelectCollege,
  onSelectCampus,
  onSelectMajor,
  onSelectPathway,
  onUpload,
  onOpenTranscriptLink,
  onRemoveTranscript,
  isDesktop,
  textClass,
  secondaryTextClass,
  cardClass,
  borderClass,
  dropdownBackgroundColor,
}: {
  collegeId: PlannerCollegeId;
  transcriptDocument: TranscriptDocument | null;
  isAnalyzing: boolean;
  errorMessage: string | null;
  studentEvaluationReport: TransferPlannerStudentEvaluationReport | null;
  studentCourseEvaluations: TransferPlannerStudentCourseEvaluation[];
  plan: TransferPlannerResolvedMajorPlan | null;
  pathwayOptions: TransferPlannerMajorPathway[];
  selectedPathwayLabel: string | null;
  hasNoDirectMajorEquivalencies: boolean;
  selectedCollegeId: PlannerCollegeId;
  selectedCollegeLabel: string;
  selectedCampusId: PlannerCampusSelectionId;
  selectedCampusLabel: string;
  selectedMajorId: string;
  selectedMajorLabel: string;
  track: TransferPlannerTrack | null;
  trackCode: string | null;
  trackTitle: string;
  trackSummary: string;
  trackOfficialLinkUrl: string | null;
  completedCourses: TranscriptCourseEntry[];
  transcriptDerivedCompletedCourses: TranscriptCourseEntry[];
  hasTranscriptDerivedCreditSource: boolean;
  openSelector: PlannerSelectorKey;
  collegeOptions: { id: string; label: string; description?: string }[];
  campusOptions: { id: string; label: string; description?: string }[];
  majorOptions: { id: string; label: string; description?: string }[];
  isPathwaySelectorOpen: boolean;
  onToggleCollege: () => void;
  onToggleCampus: () => void;
  onToggleMajor: () => void;
  onTogglePathway: () => void;
  onSelectorTouchStartInside: () => void;
  onDismissCollege: () => void;
  onDismissCampus: () => void;
  onDismissMajor: () => void;
  onSelectCollege: (id: string) => void;
  onSelectCampus: (id: string) => void;
  onSelectMajor: (id: string) => void;
  onSelectPathway: (pathwayId: string) => void;
  onUpload: () => void;
  onOpenTranscriptLink: () => void;
  onRemoveTranscript: () => void;
  isDesktop: boolean;
  textClass: string;
  secondaryTextClass: string;
  cardClass: string;
  borderClass: string;
  dropdownBackgroundColor: string;
}) {
  const { t } = useAppLanguage();
  const isUwPlanner = collegeId === "uw";
  const hasOpenSelectorOverlay = openSelector !== null || isPathwaySelectorOpen;
  const cardOverlayStyle = hasOpenSelectorOverlay
    ? {
        position: "relative" as const,
        overflow: "visible" as const,
        zIndex: 80,
        elevation: 80,
      }
    : {
        position: "relative" as const,
        overflow: "visible" as const,
      };
  const selectionFields = (
    <PlannerSelectionFields
      collegeId={collegeId}
      selectedCollegeId={selectedCollegeId}
      selectedCollegeLabel={selectedCollegeLabel}
      selectedCampusId={selectedCampusId}
      selectedCampusLabel={selectedCampusLabel}
      selectedMajorId={selectedMajorId}
      selectedMajorLabel={selectedMajorLabel}
      openSelector={openSelector}
      collegeOptions={collegeOptions}
      campusOptions={campusOptions}
      majorOptions={majorOptions}
      onToggleCollege={onToggleCollege}
      onToggleCampus={onToggleCampus}
      onToggleMajor={onToggleMajor}
      onDismissCollege={onDismissCollege}
      onDismissCampus={onDismissCampus}
      onDismissMajor={onDismissMajor}
      onSelectCollege={onSelectCollege}
      onSelectCampus={onSelectCampus}
      onSelectMajor={onSelectMajor}
      onSelectorTouchStartInside={onSelectorTouchStartInside}
      isDesktop={isDesktop}
      textClass={textClass}
      secondaryTextClass={secondaryTextClass}
      borderClass={borderClass}
      dropdownBackgroundColor={dropdownBackgroundColor}
    />
  );

  if (!transcriptDocument) {
    return (
      <View className={`${cardClass} border rounded-[28px] p-5`} style={cardOverlayStyle}>
        <View className="flex-row items-start">
          <View className="w-11 h-11 rounded-2xl bg-emerald-500/10 items-center justify-center mr-3">
            <Ionicons name="document-text-outline" size={20} color="#008f4e" />
          </View>
          <View className="flex-1 min-w-0">
            <Text className={`${textClass} text-lg font-semibold`}>
              {t("transferPlanner.uploadUnofficialTranscript")}
            </Text>
            <Text className={`${secondaryTextClass} text-sm mt-1`}>
              {t("transferPlanner.uploadUnofficialTranscriptBody")}
            </Text>
          </View>
        </View>

        <View className="gap-3 mt-4">
          <AnimatedChipPressable
            onPress={onUpload}
            className="px-4 py-3 rounded-2xl bg-emerald-500 border border-emerald-500 items-center"
          >
            <Text className="text-white font-medium">
              {t("transferPlanner.uploadUnofficialTranscriptAction")}
            </Text>
          </AnimatedChipPressable>
          <AnimatedChipPressable
            onPress={onOpenTranscriptLink}
            className="px-4 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 items-center"
          >
            <Text className="text-emerald-500 font-medium">
              {t("transferPlanner.getTranscriptInCtcLink")}
            </Text>
          </AnimatedChipPressable>
        </View>

        <View
          className={`border ${borderClass} rounded-2xl px-4 py-4 mt-5`}
          style={
            hasOpenSelectorOverlay
              ? { position: "relative", overflow: "visible", zIndex: 90, elevation: 90 }
              : { position: "relative", overflow: "visible" }
          }
        >
          {selectionFields}
        </View>

        {isUwPlanner && plan ? (
          <>
            <MajorPathwaySection
              pathwayOptions={pathwayOptions}
              selectedPathwayId={plan.selectedPathwayId}
              selectedPathwayLabel={selectedPathwayLabel}
              isPathwaySelectorOpen={isPathwaySelectorOpen}
              onTogglePathway={onTogglePathway}
              onSelectorTouchStartInside={onSelectorTouchStartInside}
              onSelectPathway={(pathwayId) => {
                onSelectPathway(pathwayId);
              }}
              textClass={textClass}
              secondaryTextClass={secondaryTextClass}
              borderClass={borderClass}
              dropdownBackgroundColor={dropdownBackgroundColor}
            />

            <PlannerTrackOverviewCard
              collegeId={collegeId}
              headerTrackId={track?.id ?? null}
              explanationTrackId={isUwPlanner ? plan.bestTrackId ?? null : track?.id ?? null}
              trackCode={trackCode}
              trackTitle={trackTitle}
              trackSummary={trackSummary}
              trackOfficialLinkUrl={trackOfficialLinkUrl}
              hasNoDirectMajorEquivalencies={hasNoDirectMajorEquivalencies}
              textClass={textClass}
              secondaryTextClass={secondaryTextClass}
              borderClass={borderClass}
            />

            <MajorSpecificsSection
              plan={plan}
              track={track}
              completedCourses={completedCourses}
              transcriptDerivedCompletedCourses={transcriptDerivedCompletedCourses}
              hasTranscriptDerivedCreditSource={hasTranscriptDerivedCreditSource}
              selectedPathwayLabel={selectedPathwayLabel}
              textClass={textClass}
              secondaryTextClass={secondaryTextClass}
              borderClass={borderClass}
            />
          </>
        ) : null}

        {!isUwPlanner ? (
          <>
            <PlannerTrackOverviewCard
              collegeId={collegeId}
              headerTrackId={track?.id ?? null}
              explanationTrackId={track?.id ?? null}
              trackCode={trackCode}
              trackTitle={trackTitle}
              trackSummary={trackSummary}
              trackOfficialLinkUrl={trackOfficialLinkUrl}
              hasNoDirectMajorEquivalencies={false}
              textClass={textClass}
              secondaryTextClass={secondaryTextClass}
              borderClass={borderClass}
            />

            <GrcDegreeSpecificsSection
              track={track}
              completedCourses={completedCourses}
              textClass={textClass}
              secondaryTextClass={secondaryTextClass}
              borderClass={borderClass}
            />
          </>
        ) : null}
    </View>
  );
  }

  return (
    <View className={`${cardClass} border rounded-[28px] p-5`} style={cardOverlayStyle}>
      <View className="flex-row items-start justify-between gap-4">
        <View className="flex-1 min-w-0">
          <Text className={`${textClass} text-lg font-semibold`}>
            {t("transferPlanner.transcriptBasedCoursePlan")}
          </Text>
          <Text className={`${secondaryTextClass} text-sm mt-1`}>
            {t("transferPlanner.transcriptBasedCoursePlanBody")}
          </Text>
        </View>
      </View>

      <View className="mt-3 flex-row items-center gap-2">
        <TouchIconButton
          onPress={onUpload}
          accessibilityLabel={t("transferPlanner.updateTranscript")}
          className="self-start"
        >
          <Text className="text-emerald-500 text-sm font-medium">
            {t("transferPlanner.updateTranscript")}
          </Text>
        </TouchIconButton>
        <Text className={`${secondaryTextClass} text-sm text-emerald-500`}>|</Text>
        <TouchIconButton
          onPress={onRemoveTranscript}
          accessibilityLabel={t("transferPlanner.removeTranscript")}
          className="self-start"
        >
          <Text className="text-emerald-500 text-sm font-medium">
            {t("transferPlanner.removeTranscript")}
          </Text>
        </TouchIconButton>
        <Text className={`${secondaryTextClass} text-sm text-emerald-500`}>|</Text>
        <TouchIconButton
          onPress={onOpenTranscriptLink}
          accessibilityRole="link"
          accessibilityLabel={t("transferPlanner.openTranscriptLink")}
          className="self-start"
        >
          <Text className="text-emerald-500 text-sm font-medium">
            {t("transferPlanner.transcriptLink")}
          </Text>
        </TouchIconButton>
      </View>

      {isAnalyzing ? (
        <View className="flex-row items-center mt-4">
          <ActivityIndicator color="#008f4e" />
          <Text className={`${secondaryTextClass} text-sm ml-3`}>
            {t("transferPlanner.pullingCompletedClasses")}
          </Text>
        </View>
      ) : null}

      {errorMessage ? (
        <View className="mt-4 px-4 py-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
          <Text className="text-amber-500 font-semibold">
            {t("transferPlanner.transcriptNeedsAnotherTry")}
          </Text>
          <Text className={`${secondaryTextClass} text-sm mt-1`}>{errorMessage}</Text>
          <TouchIconButton
            onPress={() => void openExternalLink(CTCLINK_UNOFFICIAL_TRANSCRIPT_URL)}
            accessibilityRole="link"
            accessibilityLabel={t("transferPlanner.openUnofficialTranscriptInCtcLink")}
            className="self-start"
            containerStyle={{ marginTop: 12 }}
          >
            <Text className="text-emerald-500 font-medium">
              {t("transferPlanner.openUnofficialTranscriptInCtcLink")}
            </Text>
          </TouchIconButton>
        </View>
      ) : null}

      <View
        className={`border ${borderClass} rounded-2xl px-4 py-4 mt-4`}
        style={
          hasOpenSelectorOverlay
            ? { position: "relative", overflow: "visible", zIndex: 90, elevation: 90 }
            : { position: "relative", overflow: "visible" }
        }
      >
        {selectionFields}
      </View>

      {isUwPlanner && plan ? (
        <>
          <MajorPathwaySection
            pathwayOptions={pathwayOptions}
            selectedPathwayId={plan.selectedPathwayId}
            selectedPathwayLabel={selectedPathwayLabel}
            isPathwaySelectorOpen={isPathwaySelectorOpen}
            onTogglePathway={onTogglePathway}
            onSelectorTouchStartInside={onSelectorTouchStartInside}
            onSelectPathway={(pathwayId) => {
              onSelectPathway(pathwayId);
            }}
            textClass={textClass}
            secondaryTextClass={secondaryTextClass}
            borderClass={borderClass}
            dropdownBackgroundColor={dropdownBackgroundColor}
          />

          <PlannerTrackOverviewCard
            collegeId={collegeId}
            headerTrackId={track?.id ?? null}
            explanationTrackId={isUwPlanner ? plan.bestTrackId ?? null : track?.id ?? null}
            trackCode={trackCode}
            trackTitle={trackTitle}
            trackSummary={trackSummary}
            trackOfficialLinkUrl={trackOfficialLinkUrl}
            hasNoDirectMajorEquivalencies={hasNoDirectMajorEquivalencies}
            textClass={textClass}
            secondaryTextClass={secondaryTextClass}
            borderClass={borderClass}
          />

          <MajorSpecificsSection
            plan={plan}
            track={track}
            completedCourses={completedCourses}
            transcriptDerivedCompletedCourses={transcriptDerivedCompletedCourses}
            hasTranscriptDerivedCreditSource={hasTranscriptDerivedCreditSource}
            selectedPathwayLabel={selectedPathwayLabel}
            textClass={textClass}
            secondaryTextClass={secondaryTextClass}
            borderClass={borderClass}
          />

          {studentEvaluationReport && completedCourses.length ? (
            <TranscriptEvaluationReportCard
              report={studentEvaluationReport}
              evaluations={studentCourseEvaluations}
              plan={plan}
              textClass={textClass}
              secondaryTextClass={secondaryTextClass}
              cardClass={cardClass}
              borderClass={borderClass}
              embedded
            />
          ) : null}
        </>
      ) : null}

      {!isUwPlanner ? (
        <>
          <PlannerTrackOverviewCard
            collegeId={collegeId}
            headerTrackId={track?.id ?? null}
            explanationTrackId={track?.id ?? null}
            trackCode={trackCode}
            trackTitle={trackTitle}
            trackSummary={trackSummary}
            trackOfficialLinkUrl={trackOfficialLinkUrl}
            hasNoDirectMajorEquivalencies={false}
            textClass={textClass}
            secondaryTextClass={secondaryTextClass}
            borderClass={borderClass}
          />

          <GrcDegreeSpecificsSection
            track={track}
            completedCourses={completedCourses}
            textClass={textClass}
            secondaryTextClass={secondaryTextClass}
            borderClass={borderClass}
          />
        </>
      ) : null}

    </View>
  );
}

function MajorPathwaySection({
  pathwayOptions,
  selectedPathwayId,
  selectedPathwayLabel,
  isPathwaySelectorOpen,
  onTogglePathway,
  onSelectorTouchStartInside,
  onSelectPathway,
  textClass,
  secondaryTextClass,
  borderClass,
  dropdownBackgroundColor,
}: {
  pathwayOptions: TransferPlannerMajorPathway[];
  selectedPathwayId: string | null;
  selectedPathwayLabel: string | null;
  isPathwaySelectorOpen: boolean;
  onTogglePathway: () => void;
  onSelectorTouchStartInside: () => void;
  onSelectPathway: (pathwayId: string) => void;
  textClass: string;
  secondaryTextClass: string;
  borderClass: string;
  dropdownBackgroundColor: string;
}) {
  const { t } = useAppLanguage();
  if (pathwayOptions.length <= 1) {
    return null;
  }

  return (
    <View
      className="mt-4"
      style={
        isPathwaySelectorOpen
          ? {
              position: "relative",
              zIndex: 40,
            }
          : {
              position: "relative",
            }
      }
    >
      <SelectorField
        label={t("transferPlanner.pathway")}
        value={selectedPathwayLabel ?? pathwayOptions[0]?.label ?? t("transferPlanner.selectPathway")}
        helper={t("transferPlanner.pathwayHelper")}
        open={isPathwaySelectorOpen}
        onToggle={onTogglePathway}
        onTouchStartInside={onSelectorTouchStartInside}
        options={pathwayOptions.map((pathway) => ({
          id: pathway.id,
          label: pathway.label,
          description: pathway.summary,
        }))}
        onSelect={onSelectPathway}
        selectedOptionId={selectedPathwayId ?? pathwayOptions[0]?.id ?? null}
        hideSelectedOptionWhenOpen
        textClass={textClass}
        secondaryTextClass={secondaryTextClass}
        borderClass={borderClass}
        dropdownBackgroundColor={dropdownBackgroundColor}
      />
    </View>
  );
}

function TranscriptEvaluationReportCard({
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
  const remainingGrcClassCount = report.nextPlannedCourseLabels.length;
  const remainingGrcClassNoun =
    remainingGrcClassCount === 1
      ? t("transferPlanner.classSingular")
      : t("transferPlanner.classPlural");
  const campusPossessiveLabel = report.campusLabel.endsWith("s")
    ? `${report.campusLabel}'`
    : `${report.campusLabel}'s`;
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
              {t("transferPlanner.remainingClassesBeforeTappedOut", {
                count: remainingGrcClassCount,
                classNoun: remainingGrcClassNoun,
                campus: campusPossessiveLabel,
                major: report.majorTitle,
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
                      <Text className={`${textClass} font-semibold`}>{evaluation.courseCode}</Text>
                      <Text className={`${secondaryTextClass} text-xs mt-1`} numberOfLines={2}>
                        {evaluation.targetOutcome ?? t("transferPlanner.noSourceBackedTargetOutcome")}
                      </Text>
                    </View>
                    <View className={`px-3 py-1 rounded-full border ${getEvaluationOutcomeBadgeClass(evaluation.outcome)}`}>
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
