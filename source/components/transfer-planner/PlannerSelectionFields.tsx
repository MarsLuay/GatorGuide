import { Text, View } from "react-native";

import {
  SearchableSelect,
  type SelectorOverlayStrategy,
} from "@/components/ui/SearchableSelect";
import { useAppLanguage } from "@/hooks/use-app-language";

import {
  getPlannerMajorSearchPlaceholder,
  getPlannerSelectionHelperText,
} from "./transfer-planner-copy";
import type {
  PlannerCampusSelectionId,
  PlannerCollegeId,
  PlannerSelectorKey,
} from "./transfer-planner-storage";

type PlannerSelectionOption = {
  id: string;
  label: string;
  description?: string;
};

export function SelectorField({
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
  options: PlannerSelectionOption[];
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
          searchPlaceholder={searchPlaceholder}
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

export function PlannerSelectionFields({
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
  collegeOptions: PlannerSelectionOption[];
  campusOptions: PlannerSelectionOption[];
  majorOptions: PlannerSelectionOption[];
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
