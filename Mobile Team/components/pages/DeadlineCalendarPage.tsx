import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ROUTES } from "@/constants/routes";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { StateCard } from "@/components/ui/StateCard";
import { useAppData } from "@/hooks/use-app-data";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useOpportunities } from "@/hooks/use-opportunities";
import { useThemeStyles } from "@/hooks/use-theme-styles";
import useBack from "@/hooks/use-back";
import type { Language } from "@/services/translations";
import {
  deadlineCalendarService,
  type DeadlineCalendarEntry,
} from "@/services/deadline-calendar.service";
import {
  errorLoggingService,
  roadmapService,
  type UserRoadmapDocument,
} from "@/services";

const LANGUAGE_TO_LOCALE: Record<Language, string> = {
  English: "en-US",
  Spanish: "es-ES",
  "Chinese (Simplified)": "zh-CN",
  "Chinese (Traditional)": "zh-TW",
  French: "fr-FR",
  German: "de-DE",
  Italian: "it-IT",
  Japanese: "ja-JP",
  Korean: "ko-KR",
  Portuguese: "pt-BR",
  Russian: "ru-RU",
  Arabic: "ar",
  Hindi: "hi-IN",
  Vietnamese: "vi-VN",
  Tagalog: "fil-PH",
  Persian: "fa-IR",
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getMonthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function isSameMonth(left: string, right: Date) {
  const parsed = new Date(left);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.getFullYear() === right.getFullYear() &&
    parsed.getMonth() === right.getMonth()
  );
}

function isDateKeyInMonth(dateKey: string, month: Date) {
  const [year, monthValue] = dateKey.split("-", 3).map((value) => Number(value));
  return year === month.getFullYear() && monthValue === month.getMonth() + 1;
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

function buildWeekdayLabels(locale: string, wide: boolean) {
  const formatter = new Intl.DateTimeFormat(locale, {
    weekday: wide ? "short" : "narrow",
  });

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.UTC(2024, 0, 7 + index));

    try {
      return formatter.format(date);
    } catch {
      return wide
        ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][index]
        : ["S", "M", "T", "W", "T", "F", "S"][index];
    }
  });
}

function formatKindLabel(
  item: DeadlineCalendarEntry,
  t: (key: string, params?: Record<string, string | number>) => string
) {
  if (item.kind === "scholarship") return t("deadlineCalendar.kindScholarship");
  if (item.kind === "internship") return t("deadlineCalendar.kindOpportunity");
  if (item.kind === "college_deadline") return t("deadlineCalendar.kindCollegeDeadline");
  return t("deadlineCalendar.kindRoadmapTask");
}

function getItemIcon(item: DeadlineCalendarEntry): keyof typeof MaterialIcons.glyphMap {
  if (item.kind === "scholarship") return "attach-money";
  if (item.kind === "internship") return "work-outline";
  if (item.kind === "college_deadline") return "school";
  return "checklist";
}

function getPrimaryActionLabel(
  item: DeadlineCalendarEntry,
  t: (key: string, params?: Record<string, string | number>) => string
) {
  if (item.target.type === "college") return t("deadlineCalendar.actionOpenCollege");
  if (item.target.type === "roadmap") return t("deadlineCalendar.actionOpenRoadmap");
  if (item.target.type === "resources") return t("deadlineCalendar.actionViewOpportunity");
  return t("deadlineCalendar.actionOpenLink");
}

export default function DeadlineCalendarPage() {
  const router = useRouter();
  const back = useBack();
  const { t, language } = useAppLanguage();
  const styles = useThemeStyles();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { width, fontScale } = useWindowDimensions();
  const { state, isHydrated } = useAppData();
  const { matchedOpportunities, isHydrated: areOpportunitiesHydrated } =
    useOpportunities();
  const { textClass, secondaryTextClass, cardBgClass, borderClass, placeholderColor } =
    styles;

  const user = state.user;
  const userId = user?.uid ?? "";
  const locale = LANGUAGE_TO_LOCALE[language] ?? "en-US";
  const [roadmap, setRoadmap] = useState<UserRoadmapDocument | null>(null);
  const [isRoadmapLoading, setIsRoadmapLoading] = useState(false);
  const [roadmapLoadError, setRoadmapLoadError] = useState<string | null>(null);
  const [roadmapLoadAttempt, setRoadmapLoadAttempt] = useState(0);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

  const roadmapSeed = useMemo(
    () =>
      roadmapService.buildRoadmapSeedInput({
        major: user?.major,
        gpa: user?.gpa,
        questionnaireAnswers: state.questionnaireAnswers,
        targetSchools: (state.savedColleges ?? []).map((college) => college.name),
      }),
    [state.questionnaireAnswers, state.savedColleges, user?.gpa, user?.major]
  );

  useEffect(() => {
    if (!isHydrated || !userId) return;

    let cancelled = false;
    void (async () => {
      try {
        if (!cancelled) {
          setRoadmapLoadError(null);
          setIsRoadmapLoading(true);
        }
        const nextRoadmap = user?.isGuest
          ? roadmapService.createInitialRoadmap(userId, roadmapSeed)
          : await roadmapService.ensureUserRoadmap(userId, roadmapSeed);

        if (!cancelled) setRoadmap(nextRoadmap);
      } catch (error) {
        void errorLoggingService.captureException(error, {
          category: "firestore",
          operation: "load-deadline-calendar-roadmap",
          severity: "error",
          handled: true,
          source: "deadline-calendar-page",
          screen: "deadline-calendar",
          route: "/calendar",
          metadata: {
            userId,
            isGuest: !!user?.isGuest,
          },
        });
        if (!cancelled) {
          setRoadmap(null);
          setRoadmapLoadError(
            error instanceof Error ? error.message : t("profile.prepareDataError")
          );
        }
      } finally {
        if (!cancelled) setIsRoadmapLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isHydrated, roadmapLoadAttempt, roadmapSeed, t, user?.isGuest, userId]);

  const calendarEntries = useMemo(
    () =>
      deadlineCalendarService.buildEntries({
        roadmap,
        opportunities: matchedOpportunities,
      }),
    [matchedOpportunities, roadmap]
  );

  const groups = useMemo(
    () => deadlineCalendarService.groupEntries(calendarEntries),
    [calendarEntries]
  );

  const [visibleMonth, setVisibleMonth] = useState<Date>(() => {
    const now = new Date();
    return getMonthStart(now);
  });

  useEffect(() => {
    if (!groups.length) return;
    const firstUpcoming = groups.find((group) => new Date(group.dueAt).getTime() >= Date.now());
    const anchor = firstUpcoming ?? groups[0];
    if (!anchor) return;
    setVisibleMonth((current) => {
      const target = getMonthStart(new Date(anchor.dueAt));
      if (
        current.getFullYear() === target.getFullYear() &&
        current.getMonth() === target.getMonth()
      ) {
        return current;
      }
      return target;
    });
  }, [groups]);

  useEffect(() => {
    if (!selectedDateKey) return;
    const stillVisible = groups.some((group) => group.dateKey === selectedDateKey);
    if (!stillVisible) setSelectedDateKey(null);
  }, [groups, selectedDateKey]);

  useEffect(() => {
    if (!selectedDateKey) return;
    if (!isDateKeyInMonth(selectedDateKey, visibleMonth)) {
      setSelectedDateKey(null);
    }
  }, [selectedDateKey, visibleMonth]);

  const monthGroups = useMemo(
    () => groups.filter((group) => isSameMonth(group.dueAt, visibleMonth)),
    [groups, visibleMonth]
  );

  const monthItemCount = useMemo(
    () => monthGroups.reduce((total, group) => total + group.items.length, 0),
    [monthGroups]
  );

  const displayedGroups = useMemo(() => {
    if (selectedDateKey) {
      return groups.filter((group) => group.dateKey === selectedDateKey);
    }
    if (monthGroups.length) return monthGroups;
    return groups.slice(0, 8);
  }, [groups, monthGroups, selectedDateKey]);

  const displayedItemCount = useMemo(
    () => displayedGroups.reduce((total, group) => total + group.items.length, 0),
    [displayedGroups]
  );

  const dateCountByKey = useMemo(() => {
    const counts = new Map<string, number>();
    for (const group of monthGroups) {
      counts.set(group.dateKey, group.items.length);
    }
    return counts;
  }, [monthGroups]);

  const monthGridDays = useMemo(() => {
    const firstDay = getMonthStart(visibleMonth);
    const firstWeekday = firstDay.getDay();
    const totalDays = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth() + 1,
      0
    ).getDate();
    const cells: { key: string; dateKey: string | null; day: number | null }[] = [];

    for (let index = 0; index < firstWeekday; index += 1) {
      cells.push({ key: `blank-${index}`, dateKey: null, day: null });
    }

    for (let day = 1; day <= totalDays; day += 1) {
      const date = new Date(
        visibleMonth.getFullYear(),
        visibleMonth.getMonth(),
        day
      );
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      cells.push({
        key: dateKey,
        dateKey,
        day,
      });
    }

    return cells;
  }, [visibleMonth]);

  const handleOpenEntry = async (item: DeadlineCalendarEntry) => {
    try {
      if (item.target.type === "college") {
        router.push(ROUTES.collegeDetail(item.target.collegeId));
        return;
      }

      if (item.target.type === "roadmap") {
        router.push(ROUTES.roadmap);
        return;
      }

      if (item.target.type === "resources") {
        router.push(ROUTES.tabsResources);
        return;
      }

      await Linking.openURL(item.target.url);
    } catch {
      Alert.alert(
        t("deadlineCalendar.unableToOpenTitle"),
        t("deadlineCalendar.unableToOpenMessage")
      );
    }
  };

  const todayDateKey = useMemo(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  }, []);

  const selectedGroup = selectedDateKey ? displayedGroups[0] ?? null : null;

  const layout = useMemo(() => {
    const isTablet = width >= 768;
    const isDesktop = width >= 1080;
    const horizontalPadding = width >= 1280 ? 32 : isTablet ? 24 : 16;
    const contentMaxWidth = isDesktop ? 1280 : isTablet ? 1040 : 720;
    const contentWidth = Math.min(Math.max(width - horizontalPadding * 2, 280), contentMaxWidth);
    const calendarColumnWidth = isDesktop
      ? clamp(Math.round(contentWidth * 0.38), 380, 460)
      : contentWidth;
    const calendarCardPadding = isTablet ? 20 : 16;
    const calendarInnerWidth = Math.max(260, calendarColumnWidth - calendarCardPadding * 2);
    const isCompactCalendar = calendarInnerWidth < 350 || fontScale >= 1.15;
    const showWideWeekdays = calendarInnerWidth >= 420 && fontScale <= 1.05;
    const showDayCountBadge =
      !isCompactCalendar && calendarInnerWidth >= 390 && fontScale <= 1.1;
    const dayCellSpacing = isCompactCalendar ? 2 : 3;
    const dayCellMinHeight = clamp(
      Math.floor(calendarInnerWidth / 7) - (isCompactCalendar ? 4 : 8),
      isCompactCalendar ? 44 : 52,
      isDesktop ? 74 : 68
    );

    return {
      isTablet,
      isDesktop,
      horizontalPadding,
      contentMaxWidth,
      calendarColumnWidth,
      columnGap: isDesktop ? 20 : 16,
      calendarCardPadding,
      showWideWeekdays,
      showDayCountBadge,
      dayCellSpacing,
      dayCellMinHeight,
      dayNumberFontSize: isCompactCalendar ? 12 : isTablet ? 15 : 14,
      weekdayFontSize: showWideWeekdays ? 12 : 11,
      dayMetaSlotHeight: showDayCountBadge ? 20 : 8,
      isCompactAgendaCard: !isDesktop && width < 430,
    };
  }, [fontScale, width]);

  const agendaTitle = selectedGroup
    ? formatGroupDate(selectedGroup.dueAt, locale)
    : monthGroups.length
      ? t("deadlineCalendar.agendaForMonth", {
          month: formatMonthTitle(visibleMonth, locale),
        })
      : t("deadlineCalendar.upcomingDeadlines");

  const selectedItemLabel =
    displayedItemCount === 1
      ? t("deadlineCalendar.itemSingular")
      : t("deadlineCalendar.itemPlural");
  const monthItemLabel =
    monthItemCount === 1
      ? t("deadlineCalendar.itemSingular")
      : t("deadlineCalendar.itemPlural");
  const monthDateLabel =
    monthGroups.length === 1
      ? t("deadlineCalendar.dateSingular")
      : t("deadlineCalendar.datePlural");

  const agendaSubtitle = selectedGroup
    ? t("deadlineCalendar.selectedDateSummary", {
        count: displayedItemCount,
        itemLabel: selectedItemLabel,
      })
    : monthGroups.length
      ? t("deadlineCalendar.monthSummary", {
          itemCount: monthItemCount,
          itemLabel: monthItemLabel,
          dateCount: monthGroups.length,
          dateLabel: monthDateLabel,
        })
      : t("deadlineCalendar.nextAvailableSummary");

  const weekdayLabels = useMemo(
    () => buildWeekdayLabels(locale, layout.showWideWeekdays),
    [layout.showWideWeekdays, locale]
  );

  return (
    <ScreenBackground>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: insets.top,
          paddingBottom: Math.max(tabBarHeight + 20, insets.bottom + 36),
        }}
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
          <Pressable onPress={back} className="mb-4 flex-row items-center self-start">
            <MaterialIcons name="arrow-back" size={20} color={placeholderColor} />
            <Text className={`${secondaryTextClass} ml-2`}>{t("general.back")}</Text>
          </Pressable>

          <View className={`${cardBgClass} border ${borderClass} rounded-2xl p-5 mb-4`}>
            <View className="flex-row items-start justify-between">
              <View className="flex-1 pr-4">
                <Text className={`text-2xl ${textClass} font-semibold`}>
                  {t("deadlineCalendar.title")}
                </Text>
                <Text className={`${secondaryTextClass} mt-2`}>
                  {t("deadlineCalendar.subtitle")}
                </Text>
              </View>
              <View className="w-12 h-12 rounded-2xl bg-emerald-500/15 items-center justify-center">
                <MaterialIcons name="date-range" size={24} color="#008f4e" />
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
                className={`${cardBgClass} border ${borderClass} rounded-2xl`}
                style={{ padding: layout.calendarCardPadding }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 16,
                  }}
                >
                  <Pressable
                    onPress={() => setVisibleMonth((current) => addMonths(current, -1))}
                    className="w-10 h-10 rounded-xl items-center justify-center bg-emerald-500/10"
                  >
                    <MaterialIcons name="chevron-left" size={22} color="#008f4e" />
                  </Pressable>

                  <View style={{ flex: 1, minWidth: 0 }}>
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
                  </View>

                  <Pressable
                    onPress={() => setVisibleMonth((current) => addMonths(current, 1))}
                    className="w-10 h-10 rounded-xl items-center justify-center bg-emerald-500/10"
                  >
                    <MaterialIcons name="chevron-right" size={22} color="#008f4e" />
                  </Pressable>
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
                      return <View key={cell.key} style={wrapperStyle} />;
                    }

                    const count = dateCountByKey.get(cell.dateKey) ?? 0;
                    const isSelected = selectedDateKey === cell.dateKey;
                    const isToday = todayDateKey === cell.dateKey;
                    const hasItems = count > 0;

                    return (
                      <View key={cell.key} style={wrapperStyle}>
                        <Pressable
                          onPress={() => {
                            if (!hasItems) return;
                            setSelectedDateKey((current) =>
                              current === cell.dateKey ? null : cell.dateKey
                            );
                          }}
                          className={`rounded-xl items-center ${
                            isSelected
                              ? "bg-emerald-500"
                              : hasItems
                                ? "bg-emerald-500/10"
                                : "bg-transparent"
                          } ${isToday && !isSelected ? `border ${borderClass}` : ""}`}
                          style={{
                            minHeight: layout.dayCellMinHeight,
                            paddingVertical: layout.showDayCountBadge ? 6 : 8,
                            paddingHorizontal: 2,
                            justifyContent: "center",
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
                                  className={`px-1.5 py-0.5 rounded-full ${
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
                                  style={{ width: 6, height: 6 }}
                                />
                              )
                            ) : (
                              <View
                                style={{
                                  width: layout.showDayCountBadge ? 18 : 6,
                                  height: layout.showDayCountBadge ? 14 : 6,
                                }}
                              />
                            )}
                          </View>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>

                <View className="flex-row flex-wrap gap-2 mt-4">
                  <View className="px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    <Text className="text-emerald-600 text-xs font-semibold">
                      {t("deadlineCalendar.totalItems", { count: calendarEntries.length })}
                    </Text>
                  </View>
                  <View className="px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
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
                  {selectedDateKey ? (
                    <Pressable
                      onPress={() => setSelectedDateKey(null)}
                      className="px-3 py-1.5 rounded-full border border-emerald-500/20"
                    >
                      <Text className={`${secondaryTextClass} text-xs font-semibold`}>
                        {t("deadlineCalendar.showAllDates")}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>

                <Text className={`${secondaryTextClass} text-sm mt-3`}>
                  {t("deadlineCalendar.tapHint")}
                </Text>
              </View>
            </View>

            <View style={{ flex: 1, minWidth: 0, alignSelf: "stretch" }}>
              <View className="mb-4">
                <Text className={`${textClass} text-lg font-semibold`}>{agendaTitle}</Text>
                <Text className={`${secondaryTextClass} text-sm mt-1`}>
                  {agendaSubtitle}
                </Text>
              </View>

              {!isHydrated || !areOpportunitiesHydrated || (isRoadmapLoading && !roadmap) ? (
                <StateCard
                  variant="loading"
                  title={t("deadlineCalendar.loadingTitle")}
                  message={t("deadlineCalendar.loadingMessage")}
                  className="mb-4"
                />
              ) : null}

              {roadmapLoadError && !roadmap ? (
                <StateCard
                  variant="error"
                  title={t("general.error")}
                  message={roadmapLoadError}
                  actionLabel={t("general.retry")}
                  onAction={() => setRoadmapLoadAttempt((value) => value + 1)}
                  className="mb-4"
                />
              ) : null}

              {groups.length === 0 ? (
                <StateCard
                  variant="empty"
                  title={t("deadlineCalendar.noDatedItemsTitle")}
                  message={t("deadlineCalendar.noDatedItemsMessage")}
                  className="mb-4"
                />
              ) : null}

              {monthGroups.length === 0 && groups.length > 0 && !selectedDateKey ? (
                <StateCard
                  variant="info"
                  title={t("deadlineCalendar.noItemsThisMonthTitle")}
                  message={t("deadlineCalendar.noItemsThisMonthMessage")}
                  className="mb-4"
                />
              ) : null}

              <View style={{ gap: 16 }}>
                {displayedGroups.map((group) => (
                  <View
                    key={group.dateKey}
                    className={`${cardBgClass} border ${borderClass} rounded-2xl overflow-hidden`}
                  >
                    <View className="px-5 py-4 border-b border-emerald-500/10">
                      <Text className={`${textClass} text-base font-semibold`}>
                        {formatGroupDate(group.dueAt, locale)}
                      </Text>
                      {formatRelativeDate(group.dueAt, locale) ? (
                        <Text className={`${secondaryTextClass} text-sm mt-1`}>
                          {formatRelativeDate(group.dueAt, locale)}
                        </Text>
                      ) : null}
                    </View>

                    {group.items.map((item, index) => (
                      <Pressable
                        key={item.id}
                        onPress={() => {
                          void handleOpenEntry(item);
                        }}
                        className={`px-5 py-4 ${
                          index !== group.items.length - 1 ? `border-b ${borderClass}` : ""
                        }`}
                      >
                        <View style={{ gap: layout.isCompactAgendaCard ? 14 : 0 }}>
                          <View className="flex-row items-start">
                            <View className="w-11 h-11 rounded-2xl bg-emerald-500/10 items-center justify-center mr-3">
                              <MaterialIcons
                                name={getItemIcon(item)}
                                size={20}
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

                              <Text className={`${textClass} font-semibold`} numberOfLines={2}>
                                {item.title}
                              </Text>
                              <Text className={`${secondaryTextClass} text-sm mt-1`} numberOfLines={1}>
                                {item.subtitle}
                              </Text>
                              {item.description ? (
                                <Text
                                  className={`${secondaryTextClass} text-sm mt-2`}
                                  numberOfLines={2}
                                >
                                  {item.description}
                                </Text>
                              ) : null}
                            </View>

                            {!layout.isCompactAgendaCard ? (
                              <View className="items-end justify-between min-h-[72px]">
                                <View className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                  <Text className="text-emerald-600 text-xs font-semibold">
                                    {getPrimaryActionLabel(item, t)}
                                  </Text>
                                </View>
                                <MaterialIcons
                                  name="chevron-right"
                                  size={20}
                                  color={placeholderColor}
                                />
                              </View>
                            ) : null}
                          </View>

                          {layout.isCompactAgendaCard ? (
                            <View className="flex-row items-center justify-between">
                              <View className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                <Text className="text-emerald-600 text-xs font-semibold">
                                  {getPrimaryActionLabel(item, t)}
                                </Text>
                              </View>
                              <MaterialIcons
                                name="chevron-right"
                                size={20}
                                color={placeholderColor}
                              />
                            </View>
                          ) : null}
                        </View>
                      </Pressable>
                    ))}
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}
