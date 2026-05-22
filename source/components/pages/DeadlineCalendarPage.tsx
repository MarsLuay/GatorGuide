import React from "react";
import {
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { StateCard } from "@/components/ui/StateCard";
import {
  AnimatedCardPressable,
  AnimatedChipPressable,
  AnimatedIconPressable,
} from "@/components/ui/AnimatedPressables";
import { PageBackButton } from "@/components/ui/PageBackButton";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useThemeStyles } from "@/hooks/use-theme-styles";
import useBack from "@/hooks/use-back";
import type { DeadlineCalendarEntry } from "@/services/deadlines/deadline-calendar.service";
import { useDeadlineCalendarController } from "@/components/pages/deadline-calendar/useDeadlineCalendarController";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function formatMonthTitle(value: Date, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale, {
      month: "long",
      year: "numeric",
    }).format(value);
  } catch {
    return value.toDateString();
  }
}

function formatGroupDate(value: string, locale: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  try {
    return new Intl.DateTimeFormat(locale, {
      weekday: "short",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(parsed);
  } catch {
    return parsed.toDateString();
  }
}

function formatRelativeDate(value: string, locale: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";

  const today = new Date();
  const startToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const startTarget = new Date(
    parsed.getFullYear(),
    parsed.getMonth(),
    parsed.getDate()
  );
  const diffDays = Math.round(
    (startTarget.getTime() - startToday.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays < -14 || diffDays > 14) return "";

  try {
    return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
      diffDays,
      "day"
    );
  } catch {
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays === -1) return "Yesterday";
    if (diffDays > 1) return `In ${diffDays} days`;
    return `${Math.abs(diffDays)} days ago`;
  }
}

function normalizeAgendaText(value: string | null | undefined) {
  if (!value) return "";
  return value.replace(/\s+/g, " ").trim();
}

function buildAgendaPreviewText(
  value: string | null | undefined,
  maxChars: number
) {
  const normalized = normalizeAgendaText(value);
  if (!normalized) return "";
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, Math.max(0, maxChars - 1)).trimEnd()}...`;
}

function formatKindLabel(
  item: DeadlineCalendarEntry,
  t: (key: string, params?: Record<string, string | number>) => string
) {
  if (item.kind === "scholarship") return t("deadlineCalendar.kindScholarship");
  if (item.kind === "internship") return t("deadlineCalendar.kindOpportunity");
  if (item.kind === "college_deadline") return t("deadlineCalendar.kindCollegeDeadline");
  if (item.kind === "quarter-start") return "Quarter Start";
  if (item.kind === "quarter-end") return "Quarter End";
  if (item.kind === "general_deadline") return "General deadline";
  return t("deadlineCalendar.kindRoadmapTask");
}

function getItemIcon(item: DeadlineCalendarEntry): keyof typeof MaterialIcons.glyphMap {
  if (item.kind === "scholarship") return "attach-money";
  if (item.kind === "internship") return "work-outline";
  if (item.kind === "college_deadline") return "school";
  if (item.kind === "quarter-start") return "event-available";
  if (item.kind === "quarter-end") return "event-note";
  if (item.kind === "general_deadline") return "event";
  return "checklist";
}

function getPrimaryActionLabel(
  item: DeadlineCalendarEntry,
  t: (key: string, params?: Record<string, string | number>) => string
) {
  if (item.target.type === "college") return t("deadlineCalendar.actionOpenCollege");
  if (item.target.type === "roadmap") return "Shown here";
  if (item.target.type === "resources") return t("deadlineCalendar.actionViewOpportunity");
  return t("deadlineCalendar.actionOpenLink");
}

export default function DeadlineCalendarPage() {
  const back = useBack();
  const { t, language } = useAppLanguage();
  const styles = useThemeStyles();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { width, fontScale } = useWindowDimensions();
  const { textClass, secondaryTextClass, cardBgClass, borderClass, placeholderColor } =
    styles;
  const {
    isHydrated,
    areOpportunitiesHydrated,
    roadmap,
    isRoadmapLoading,
    roadmapLoadError,
    retryRoadmapLoad,
    locale,
    todayDateKey,
    selectedDateKey,
    setSelectedDateKey,
    visibleMonth,
    setVisibleMonth,
    calendarEntries,
    groups,
    monthGroups,
    displayedGroups,
    displayedItemCount,
    dateCountByKey,
    monthGridDays,
    handleOpenEntry,
    focusGroup,
    focusPreviewItems,
    focusRelativeLabel,
    focusSummary,
    agendaTitle,
    agendaSubtitle,
    selectedItemLabel,
    monthItemCount,
    monthItemLabel,
    layout,
    weekdayLabels,
  } = useDeadlineCalendarController({ t, language, width, fontScale });

  return (
    <ScreenBackground>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: insets.top,
          paddingBottom: Math.max(tabBarHeight + 20, insets.bottom + 36),
        }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            width: "100%",
            maxWidth: layout.contentMaxWidth,
            alignSelf: "center",
            paddingHorizontal: layout.horizontalPadding,
            paddingTop: 24,
          }}
        >
          <PageBackButton onPress={back} label={t("general.back")} textClassName={secondaryTextClass} />

          <View
            className={`${cardBgClass} border ${borderClass} rounded-[28px] overflow-hidden mb-5`}
            style={{ padding: layout.heroPadding }}
          >
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: -32,
                right: -18,
                width: 152,
                height: 152,
                borderRadius: 999,
                backgroundColor: "rgba(16,185,129,0.10)",
              }}
            />
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                bottom: -28,
                left: -10,
                width: 104,
                height: 104,
                borderRadius: 999,
                backgroundColor: "rgba(14,165,233,0.08)",
              }}
            />
            <View className="flex-row items-start justify-between">
              <View className="flex-1 pr-4" style={{ minWidth: 0 }}>
                <Text className={`text-2xl ${textClass} font-semibold`}>
                  {t("deadlineCalendar.title")}
                </Text>
                <Text className={`${secondaryTextClass} mt-2`}>
                  {t("deadlineCalendar.subtitle")}
                </Text>
              </View>
              <View className="w-14 h-14 rounded-[22px] bg-emerald-500/15 border border-emerald-500/20 items-center justify-center">
                <MaterialIcons name="date-range" size={24} color="#008f4e" />
              </View>
            </View>

            <View
              style={{
                flexDirection: layout.isTablet ? "row" : "column",
                flexWrap: layout.isTablet ? "wrap" : "nowrap",
                gap: 8,
                marginTop: 16,
              }}
            >
              <View
                className="px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20"
                style={!layout.isTablet ? { width: "100%", alignItems: "center" } : undefined}
              >
                <Text className="text-emerald-600 text-xs font-semibold">
                  {formatMonthTitle(visibleMonth, locale)}
                </Text>
              </View>
              <View
                className="px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20"
                style={!layout.isTablet ? { width: "100%", alignItems: "center" } : undefined}
              >
                <Text className="text-emerald-600 text-xs font-semibold">
                  {t("deadlineCalendar.totalItems", { count: calendarEntries.length })}
                </Text>
              </View>
              <View
                className="px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20"
                style={!layout.isTablet ? { width: "100%", alignItems: "center" } : undefined}
              >
                <Text className="text-emerald-600 text-xs font-semibold">
                  {t("deadlineCalendar.activeDatesThisMonth", {
                    count: monthGroups.length,
                    dateLabel:
                      monthGroups.length === 1
                        ? t("deadlineCalendar.dateSingular")
                        : t("deadlineCalendar.datePlural"),
                  })}
                </Text>
              </View>
            </View>
          </View>

          <View
            style={{
              flexDirection: layout.isDesktop ? "row" : "column",
              alignItems: "flex-start",
              gap: layout.columnGap,
            }}
          >
            <View
              style={{
                width: layout.isDesktop ? layout.calendarColumnWidth : "100%",
                alignSelf: "stretch",
              }}
            >
              <View
                className={`${cardBgClass} border ${borderClass} rounded-[28px] overflow-hidden`}
                style={{
                  padding: layout.panelPadding,
                  minHeight: layout.calendarPanelMinHeight,
                }}
              >
                <View
                  style={{
                    flexDirection: layout.isTablet ? "row" : "column",
                    alignItems: layout.isTablet ? "flex-start" : "stretch",
                    justifyContent: "space-between",
                    gap: 12,
                    marginBottom: 18,
                  }}
                >
                  <View className="flex-row items-center" style={{ flex: 1, minWidth: 0 }}>
                    <View className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/15 items-center justify-center mr-3">
                      <MaterialIcons name="calendar-today" size={20} color="#008f4e" />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        className={`${secondaryTextClass} text-xs font-semibold uppercase`}
                        style={{ letterSpacing: 0.8 }}
                      >
                        {t("deadlineCalendar.title")}
                      </Text>
                      <Text
                        className={`${textClass} font-semibold mt-1`}
                        style={{ fontSize: layout.isTablet ? 19 : 17 }}
                        numberOfLines={1}
                      >
                        {formatMonthTitle(visibleMonth, locale)}
                      </Text>
                    </View>
                  </View>

                  <View
                    className="px-3 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20"
                    style={!layout.isTablet ? { alignItems: "center" } : undefined}
                  >
                    <Text className="text-emerald-600 text-xs font-semibold">
                      {monthItemCount} {monthItemLabel}
                    </Text>
                  </View>
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 18,
                  }}
                >
                  <AnimatedIconPressable
                    onPress={() => setVisibleMonth((current) => addMonths(current, -1))}
                    className="w-10 h-10 rounded-xl items-center justify-center bg-emerald-500/10"
                  >
                    <MaterialIcons name="chevron-left" size={22} color="#008f4e" />
                  </AnimatedIconPressable>

                  <View style={{ flex: 1, minWidth: 0, alignItems: "center" }}>
                    <Text
                      className={`${textClass} font-semibold`}
                      style={{
                        fontSize: layout.isTablet ? 18 : 16,
                        textAlign: "center",
                      }}
                      numberOfLines={1}
                    >
                      {formatMonthTitle(visibleMonth, locale)}
                    </Text>
                    <Text
                      className={`${secondaryTextClass} text-sm mt-1`}
                      numberOfLines={2}
                      style={{ textAlign: "center" }}
                    >
                      {agendaSubtitle}
                    </Text>
                  </View>

                  <AnimatedIconPressable
                    onPress={() => setVisibleMonth((current) => addMonths(current, 1))}
                    className="w-10 h-10 rounded-xl items-center justify-center bg-emerald-500/10"
                  >
                    <MaterialIcons name="chevron-right" size={22} color="#008f4e" />
                  </AnimatedIconPressable>
                </View>

                <View className="flex-row mb-2">
                  {weekdayLabels.map((label, index) => (
                    <Text
                      key={`weekday-${index}`}
                      className={`${secondaryTextClass} text-center`}
                      style={{
                        width: "14.2857%",
                        fontSize: layout.weekdayFontSize,
                        lineHeight: layout.weekdayFontSize + 4,
                      }}
                    >
                      {label}
                    </Text>
                  ))}
                </View>

                <View className="flex-row flex-wrap">
                  {monthGridDays.map((cell) => {
                    const wrapperStyle = {
                      width: "14.2857%" as const,
                      padding: layout.dayCellSpacing,
                      minHeight:
                        layout.dayCellMinHeight + layout.dayCellSpacing * 2,
                    };

                    if (!cell.dateKey || !cell.day) {
                      return (
                        <View key={cell.key} style={wrapperStyle}>
                          <View
                            style={{
                              minHeight: layout.dayCellMinHeight,
                              borderRadius: 18,
                              backgroundColor: "rgba(16,185,129,0.03)",
                            }}
                          />
                        </View>
                      );
                    }

                    const count = dateCountByKey.get(cell.dateKey) ?? 0;
                    const isSelected = selectedDateKey === cell.dateKey;
                    const isToday = todayDateKey === cell.dateKey;
                    const hasItems = count > 0;

                    return (
                      <View key={cell.key} style={wrapperStyle}>
                        {/* touch-audit-ignore: calendar grid cell is a deliberately dense full-cell target sized by layout.dayCellMinHeight. */}
                        <Pressable
                          onPress={() => {
                            if (!hasItems) return;
                            setSelectedDateKey((current) =>
                              current === cell.dateKey ? null : cell.dateKey
                            );
                          }}
                          className={`rounded-[18px] items-center ${
                            isToday && !isSelected ? `border ${borderClass}` : ""
                          }`}
                          style={{
                            minHeight: layout.dayCellMinHeight,
                            paddingVertical: layout.showDayCountBadge ? 8 : 10,
                            paddingHorizontal: 4,
                            justifyContent: "center",
                            backgroundColor: isSelected
                              ? "#10b981"
                              : hasItems
                                ? "rgba(16,185,129,0.11)"
                                : "rgba(16,185,129,0.03)",
                          }}
                        >
                          <Text
                            className={`font-semibold ${
                              isSelected ? "text-white" : textClass
                            } ${!hasItems ? "opacity-60" : ""}`}
                            style={{
                              fontSize: layout.dayNumberFontSize,
                              lineHeight: layout.dayNumberFontSize + 4,
                            }}
                          >
                            {cell.day}
                          </Text>

                          <View
                            style={{
                              minHeight: layout.dayMetaSlotHeight,
                              justifyContent: "center",
                              marginTop: layout.showDayCountBadge ? 4 : 6,
                            }}
                          >
                            {hasItems ? (
                              layout.showDayCountBadge ? (
                                <View
                                  className={`px-2 py-0.5 rounded-full ${
                                    isSelected ? "bg-white/20" : "bg-emerald-500/20"
                                  }`}
                                >
                                  <Text
                                    className={`font-semibold ${
                                      isSelected ? "text-white" : "text-emerald-600"
                                    }`}
                                    style={{ fontSize: 10, lineHeight: 12 }}
                                  >
                                    {count}
                                  </Text>
                                </View>
                              ) : (
                                <View
                                  className={`rounded-full ${
                                    isSelected ? "bg-white" : "bg-emerald-500"
                                  }`}
                                  style={{
                                    width: clamp(10 + count * 4, 10, 20),
                                    height: 5,
                                  }}
                                />
                              )
                            ) : (
                              <View
                                style={{
                                  width: layout.showDayCountBadge ? 20 : 10,
                                  height: layout.showDayCountBadge ? 16 : 5,
                                }}
                              />
                            )}
                          </View>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>

                <View
                  style={{
                    marginTop: 16,
                    padding: layout.isTablet ? 16 : 14,
                    borderRadius: 24,
                    borderWidth: 1,
                    borderColor: "rgba(16,185,129,0.14)",
                    backgroundColor: "rgba(16,185,129,0.06)",
                    gap: 12,
                  }}
                >
                  <View
                    style={{
                      flexDirection: layout.isTablet ? "row" : "column",
                      alignItems: layout.isTablet ? "flex-start" : "stretch",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        className={`${secondaryTextClass} text-xs font-semibold uppercase`}
                        style={{ letterSpacing: 0.8 }}
                      >
                        {focusSummary}
                      </Text>

                      {focusGroup ? (
                        <>
                          <Text className={`${textClass} font-semibold mt-2`} numberOfLines={2}>
                            {formatGroupDate(focusGroup.dueAt, locale)}
                          </Text>
                          {focusRelativeLabel ? (
                            <Text className={`${secondaryTextClass} text-sm mt-1`}>
                              {focusRelativeLabel}
                            </Text>
                          ) : null}
                        </>
                      ) : (
                        <Text className={`${secondaryTextClass} text-sm mt-2`}>
                          {t("deadlineCalendar.noDatedItemsMessage")}
                        </Text>
                      )}
                    </View>

                    {focusGroup ? (
                      <View className="px-3 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                        <Text className="text-emerald-600 text-xs font-semibold">
                          {focusGroup.items.length}{" "}
                          {focusGroup.items.length === 1
                            ? t("deadlineCalendar.itemSingular")
                            : t("deadlineCalendar.itemPlural")}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {focusPreviewItems.length ? (
                    <View style={{ gap: 10 }}>
                      {focusPreviewItems.map((item) => (
                        <View key={`focus-${item.id}`} className="flex-row items-center">
                          <View className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/15 items-center justify-center mr-3">
                            <MaterialIcons
                              name={getItemIcon(item)}
                              size={16}
                              color="#008f4e"
                            />
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text className={`${textClass} font-medium`} numberOfLines={1}>
                              {item.title}
                            </Text>
                            <Text className={`${secondaryTextClass} text-sm`} numberOfLines={1}>
                              {buildAgendaPreviewText(
                                item.subtitle || item.description,
                                layout.isDesktop ? 84 : 60
                              )}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  <Text className={`${secondaryTextClass} text-sm`}>
                    {t("deadlineCalendar.tapHint")}
                  </Text>
                </View>
              </View>
            </View>

            <View style={{ flex: 1, minWidth: 0, alignSelf: "stretch" }}>
              <View
                className={`${cardBgClass} border ${borderClass} rounded-[28px] overflow-hidden`}
                style={{
                  padding: layout.panelPadding,
                  minHeight: layout.agendaPanelMinHeight,
                }}
              >
                <View
                  style={{
                    flexDirection: layout.isTablet ? "row" : "column",
                    alignItems: layout.isTablet ? "center" : "stretch",
                    justifyContent: "space-between",
                    gap: layout.agendaHeaderGap,
                    marginBottom: 18,
                  }}
                >
                  <View className="flex-row items-center" style={{ flex: 1, minWidth: 0 }}>
                    <View className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/15 items-center justify-center mr-3">
                      <MaterialIcons name="view-agenda" size={20} color="#008f4e" />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        className={`${secondaryTextClass} text-xs font-semibold uppercase`}
                        style={{ letterSpacing: 0.8 }}
                      >
                        {selectedDateKey ? t("deadlineCalendar.title") : agendaTitle}
                      </Text>
                      <Text
                        className={`${textClass} font-semibold mt-1`}
                        style={{ fontSize: layout.isTablet ? 19 : 17 }}
                        numberOfLines={2}
                      >
                        {agendaTitle}
                      </Text>
                      <Text className={`${secondaryTextClass} text-sm mt-1`} numberOfLines={2}>
                        {agendaSubtitle}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={{
                      flexDirection: layout.isTablet ? "row" : "column",
                      flexWrap: layout.isTablet ? "wrap" : "nowrap",
                      gap: 8,
                      justifyContent: layout.isTablet ? "flex-end" : "flex-start",
                    }}
                  >
                    {selectedDateKey ? (
                      <AnimatedChipPressable
                        onPress={() => setSelectedDateKey(null)}
                        className="px-3 py-2 rounded-2xl border border-emerald-500/20"
                        containerStyle={!layout.isTablet ? { width: "100%" } : undefined}
                        style={!layout.isTablet ? { width: "100%", alignItems: "center" } : undefined}
                      >
                        <Text className={`${secondaryTextClass} text-xs font-semibold`}>
                          {t("deadlineCalendar.showAllDates")}
                        </Text>
                      </AnimatedChipPressable>
                    ) : null}

                    <View
                      className="px-3 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20"
                      style={!layout.isTablet ? { width: "100%", alignItems: "center" } : undefined}
                    >
                      <Text className="text-emerald-600 text-xs font-semibold">
                        {displayedItemCount} {selectedItemLabel}
                      </Text>
                    </View>
                  </View>
                </View>

                {!isHydrated || !areOpportunitiesHydrated || (isRoadmapLoading && !roadmap) ? (
                  <StateCard
                    variant="loading"
                    title={t("deadlineCalendar.loadingTitle")}
                    message={t("deadlineCalendar.loadingMessage")}
                    compact
                    centered={false}
                    className="mb-3"
                  />
                ) : null}

                {roadmapLoadError && !roadmap ? (
                  <StateCard
                    variant="error"
                    title={t("general.error")}
                    message={roadmapLoadError}
                    actionLabel={t("general.retry")}
                    onAction={retryRoadmapLoad}
                    compact
                    centered={false}
                    className="mb-3"
                  />
                ) : null}

                {groups.length === 0 ? (
                  <StateCard
                    variant="empty"
                    title={t("deadlineCalendar.noDatedItemsTitle")}
                    message={t("deadlineCalendar.noDatedItemsMessage")}
                    compact
                    centered={false}
                    className="mb-3"
                  />
                ) : null}

                {monthGroups.length === 0 && groups.length > 0 && !selectedDateKey ? (
                  <StateCard
                    variant="info"
                    title={t("deadlineCalendar.noItemsThisMonthTitle")}
                    message={t("deadlineCalendar.noItemsThisMonthMessage")}
                    compact
                    centered={false}
                    className="mb-3"
                  />
                ) : null}

                {monthGroups.length > 0 && displayedGroups.length === 0 && !selectedDateKey ? (
                  <StateCard
                    variant="info"
                    title={t("deadlineCalendar.selectDateToRevealTitle")}
                    message={t("deadlineCalendar.selectDateToRevealMessage")}
                    compact
                    centered={false}
                    className="mb-3"
                  />
                ) : null}

                <View
                  style={{
                    flexDirection: layout.agendaGroupColumns === 2 ? "row" : "column",
                    flexWrap: layout.agendaGroupColumns === 2 ? "wrap" : "nowrap",
                    gap: layout.agendaGroupGap,
                  }}
                >
                  {displayedGroups.map((group) => {
                    const relativeLabel = formatRelativeDate(group.dueAt, locale);

                    return (
                      <View
                        key={group.dateKey}
                        style={{
                          width: layout.agendaGroupColumns === 2 ? "48.8%" : "100%",
                          minWidth: 0,
                          borderRadius: 24,
                          borderWidth: 1,
                          borderColor: "rgba(16,185,129,0.14)",
                          backgroundColor: "rgba(16,185,129,0.05)",
                          overflow: "hidden",
                        }}
                      >
                        <View
                          style={{
                            paddingHorizontal: layout.isTablet ? 18 : 16,
                            paddingVertical: 14,
                            borderBottomWidth: 1,
                            borderBottomColor: "rgba(16,185,129,0.12)",
                            flexDirection: layout.isTablet ? "row" : "column",
                            alignItems: layout.isTablet ? "flex-start" : "stretch",
                            justifyContent: "space-between",
                            gap: 12,
                          }}
                        >
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text className={`${textClass} text-base font-semibold`}>
                              {formatGroupDate(group.dueAt, locale)}
                            </Text>
                            {relativeLabel ? (
                              <Text className={`${secondaryTextClass} text-sm mt-1`}>
                                {relativeLabel}
                              </Text>
                            ) : null}
                          </View>

                          <View
                            className="px-3 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/15"
                            style={!layout.isTablet ? { alignItems: "center" } : undefined}
                          >
                            <Text className="text-emerald-600 text-xs font-semibold">
                              {group.items.length}{" "}
                              {group.items.length === 1
                                ? t("deadlineCalendar.itemSingular")
                                : t("deadlineCalendar.itemPlural")}
                            </Text>
                          </View>
                        </View>

                        {group.items.map((item, index) => {
                          const subtitlePreview = buildAgendaPreviewText(
                            item.subtitle || item.sourceLabel,
                            layout.isDenseAgenda ? 60 : layout.isDesktop ? 90 : 72
                          );
                          const descriptionPreview = buildAgendaPreviewText(
                            item.description,
                            layout.agendaDescriptionCharLimit
                          );
                          const showDescription =
                            !!descriptionPreview &&
                            (!layout.isDenseAgenda || layout.isDesktop || !subtitlePreview);
                          const actionLabel = getPrimaryActionLabel(item, t);
                          const isRoadmapItem = item.target.type === "roadmap";

                          return (
                            <AnimatedCardPressable
                              key={item.id}
                              onPress={() => {
                                void handleOpenEntry(item);
                              }}
                              style={{
                                paddingHorizontal: layout.agendaCardPadding,
                                paddingVertical: layout.agendaCardPadding,
                                minHeight: layout.agendaRowMinHeight,
                                borderBottomWidth: index !== group.items.length - 1 ? 1 : 0,
                                borderBottomColor: "rgba(16,185,129,0.12)",
                              }}
                            >
                              <View style={{ gap: layout.isCompactAgendaCard ? 12 : 0 }}>
                                <View className="flex-row items-start">
                                  <View
                                    className="rounded-2xl bg-emerald-500/10 border border-emerald-500/15 items-center justify-center mr-3"
                                    style={{
                                      width: layout.agendaIconSize,
                                      height: layout.agendaIconSize,
                                    }}
                                  >
                                    <MaterialIcons
                                      name={getItemIcon(item)}
                                      size={layout.isDenseAgenda ? 18 : 20}
                                      color="#008f4e"
                                    />
                                  </View>

                                  <View
                                    style={{
                                      flex: 1,
                                      minWidth: 0,
                                      paddingRight: layout.isCompactAgendaCard ? 0 : 12,
                                    }}
                                  >
                                    <View className="flex-row flex-wrap gap-2 mb-2">
                                      <View className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                                        <Text className="text-emerald-600 text-xs font-semibold">
                                          {formatKindLabel(item, t)}
                                        </Text>
                                      </View>
                                      {item.isDone ? (
                                        <View className="px-2.5 py-1 rounded-full bg-slate-500/10 border border-slate-500/20">
                                          <Text className={`${secondaryTextClass} text-xs font-semibold`}>
                                            {t("deadlineCalendar.done")}
                                          </Text>
                                        </View>
                                      ) : null}
                                    </View>

                                    <Text
                                      className={`${textClass} font-semibold`}
                                      numberOfLines={2}
                                      style={{
                                        fontSize: layout.agendaTitleFontSize,
                                        lineHeight: layout.agendaTitleLineHeight,
                                      }}
                                    >
                                      {item.title}
                                    </Text>

                                    {subtitlePreview ? (
                                      <View
                                        style={{
                                          minHeight: layout.agendaSubtitleMinHeight,
                                          justifyContent: "flex-start",
                                          marginTop: 4,
                                        }}
                                      >
                                        <Text
                                          className={`${secondaryTextClass} text-sm`}
                                          numberOfLines={layout.agendaSubtitleLines}
                                          style={{ lineHeight: layout.agendaSubtitleLineHeight }}
                                        >
                                          {subtitlePreview}
                                        </Text>
                                      </View>
                                    ) : null}

                                    {showDescription ? (
                                      <View
                                        style={{
                                          minHeight: layout.agendaDescriptionSlotMinHeight,
                                          justifyContent: "flex-start",
                                          marginTop: subtitlePreview ? 6 : 8,
                                        }}
                                      >
                                        <Text
                                          className={`${secondaryTextClass} text-sm`}
                                          numberOfLines={layout.agendaDescriptionLines}
                                          style={{ lineHeight: layout.agendaDescriptionLineHeight }}
                                        >
                                          {descriptionPreview}
                                        </Text>
                                      </View>
                                    ) : null}
                                  </View>

                                  {!layout.isCompactAgendaCard ? (
                                    <View
                                      className="items-end justify-between"
                                      style={{ minHeight: layout.agendaActionColumnMinHeight }}
                                    >
                                      <View
                                        className={`px-3 py-2 rounded-2xl border ${
                                          isRoadmapItem
                                            ? "bg-slate-500/10 border-slate-500/20"
                                            : "bg-emerald-500/10 border-emerald-500/20"
                                        }`}
                                      >
                                        <Text
                                          className={`text-xs font-semibold ${
                                            isRoadmapItem ? secondaryTextClass : "text-emerald-600"
                                          }`}
                                        >
                                          {actionLabel}
                                        </Text>
                                      </View>

                                      {!isRoadmapItem ? (
                                        <MaterialIcons
                                          name="chevron-right"
                                          size={20}
                                          color={placeholderColor}
                                        />
                                      ) : null}
                                    </View>
                                  ) : null}
                                </View>

                                {layout.isCompactAgendaCard ? (
                                  <View
                                    style={{
                                      flexDirection: layout.isTablet ? "row" : "column",
                                      alignItems: layout.isTablet ? "center" : "stretch",
                                      justifyContent: "space-between",
                                      gap: 8,
                                    }}
                                  >
                                    <View
                                      className={`px-3 py-2 rounded-2xl border ${
                                        isRoadmapItem
                                          ? "bg-slate-500/10 border-slate-500/20"
                                          : "bg-emerald-500/10 border-emerald-500/20"
                                      }`}
                                      style={!layout.isTablet ? { alignItems: "center" } : undefined}
                                    >
                                      <Text
                                        className={`text-xs font-semibold ${
                                          isRoadmapItem ? secondaryTextClass : "text-emerald-600"
                                        }`}
                                      >
                                        {actionLabel}
                                      </Text>
                                    </View>

                                    {!isRoadmapItem ? (
                                      <MaterialIcons
                                        name="chevron-right"
                                        size={20}
                                        color={placeholderColor}
                                      />
                                    ) : null}
                                  </View>
                                ) : null}
                              </View>
                            </AnimatedCardPressable>
                          );
                        })}
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}
