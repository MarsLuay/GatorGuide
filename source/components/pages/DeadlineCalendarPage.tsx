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
import {
  AnimatedCardPressable,
  AnimatedChipPressable,
  AnimatedIconPressable,
} from "@/components/ui/AnimatedPressables";
import { useAppData } from "@/hooks/use-app-data";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useOpportunities } from "@/hooks/use-opportunities";
import { useThemeStyles } from "@/hooks/use-theme-styles";
import useBack from "@/hooks/use-back";
import type { Language } from "@/services/app/translations";
import {
  deadlineCalendarService,
  UPCOMING_DEADLINE_WINDOW_DAYS,
  type DeadlineCalendarEntry,
  type DeadlineCalendarGroup,
} from "@/services/deadlines/deadline-calendar.service";
import { errorLoggingService } from "@/services/logging/error-logging.service";
import {
  roadmapService,
  type UserRoadmapDocument,
} from "@/services/planning/roadmap.service";

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

function findUpcomingGroup(groups: DeadlineCalendarGroup[]) {
  return groups.find((group) => new Date(group.dueAt).getTime() >= Date.now()) ?? groups[0] ?? null;
}

function formatKindLabel(
  item: DeadlineCalendarEntry,
  t: (key: string, params?: Record<string, string | number>) => string
) {
  if (item.kind === "scholarship") return t("deadlineCalendar.kindScholarship");
  if (item.kind === "internship") return t("deadlineCalendar.kindOpportunity");
  if (item.kind === "college_deadline") return t("deadlineCalendar.kindCollegeDeadline");
  if (item.kind === "general_deadline") return "General deadline";
  return t("deadlineCalendar.kindRoadmapTask");
}

function getItemIcon(item: DeadlineCalendarEntry): keyof typeof MaterialIcons.glyphMap {
  if (item.kind === "scholarship") return "attach-money";
  if (item.kind === "internship") return "work-outline";
  if (item.kind === "college_deadline") return "school";
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
    const upcomingWindowGroups = deadlineCalendarService.filterUpcomingGroups(
      groups,
      UPCOMING_DEADLINE_WINDOW_DAYS
    );
    setVisibleMonth((current) => {
      const target = upcomingWindowGroups[0]
        ? getMonthStart(new Date(upcomingWindowGroups[0].dueAt))
        : getMonthStart(new Date());
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

  const fallbackUpcomingGroups = useMemo(
    () =>
      deadlineCalendarService
        .filterUpcomingGroups(groups, UPCOMING_DEADLINE_WINDOW_DAYS)
        .slice(0, 8),
    [groups]
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
    return fallbackUpcomingGroups;
  }, [fallbackUpcomingGroups, groups, monthGroups, selectedDateKey]);

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

    while (cells.length < 42) {
      cells.push({
        key: `trailing-${cells.length}`,
        dateKey: null,
        day: null,
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

      if (item.target.type === "roadmap") return;

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
  const monthFocusGroup = useMemo(() => findUpcomingGroup(monthGroups), [monthGroups]);
  const focusGroup = selectedGroup ?? monthFocusGroup ?? fallbackUpcomingGroups[0] ?? null;

  const layout = useMemo(() => {
    const isTablet = width >= 768;
    const isDesktop = width >= 1080;
    const horizontalPadding = width >= 1280 ? 32 : isTablet ? 24 : 16;
    const contentMaxWidth = isDesktop ? 1280 : isTablet ? 1040 : 720;
    const contentWidth = Math.min(Math.max(width - horizontalPadding * 2, 280), contentMaxWidth);
    const calendarColumnWidth = isDesktop
      ? clamp(Math.round(contentWidth * 0.38), 380, 460)
      : contentWidth;
    const panelPadding = isTablet ? 20 : 16;
    const calendarInnerWidth = Math.max(260, calendarColumnWidth - panelPadding * 2);
    const isCompactCalendar = calendarInnerWidth < 350 || fontScale >= 1.15;
    const showWideWeekdays = calendarInnerWidth >= 420 && fontScale <= 1.05;
    const showDayCountBadge =
      !isCompactCalendar && calendarInnerWidth >= 390 && fontScale <= 1.1;
    const dayCellSpacing = isCompactCalendar ? 2 : 3;
    const dayCellMinHeight = clamp(
      Math.floor(calendarInnerWidth / 7) - (isCompactCalendar ? 8 : 10),
      isCompactCalendar ? 42 : 48,
      isDesktop ? 64 : 58
    );
    const isDenseAgenda =
      displayedItemCount >= (isDesktop ? 9 : isTablet ? 7 : 5) ||
      displayedGroups.length >= (isDesktop ? 5 : 4);
    const agendaTitleLineHeight = isTablet ? 22 : 20;
    const agendaSubtitleLineHeight = 20;
    const agendaDescriptionLineHeight = 19;
    const agendaSubtitleLines = isDenseAgenda ? 1 : isDesktop ? 2 : 1;
    const agendaDescriptionLines = isDenseAgenda ? (isDesktop ? 2 : 1) : isDesktop ? 3 : 2;
    const agendaDescriptionSlotMinHeight = !isDenseAgenda && isDesktop
      ? agendaDescriptionLineHeight * agendaDescriptionLines
      : 0;
    const calendarPanelMinHeight =
      dayCellMinHeight * 6 + (showDayCountBadge ? (isTablet ? 240 : 228) : isTablet ? 224 : 208);

    return {
      isTablet,
      isDesktop,
      isDenseAgenda,
      horizontalPadding,
      contentMaxWidth,
      calendarColumnWidth,
      columnGap: isDesktop ? 20 : 16,
      heroPadding: isTablet ? 24 : 20,
      panelPadding,
      showWideWeekdays,
      showDayCountBadge,
      dayCellSpacing,
      dayCellMinHeight,
      calendarPanelMinHeight,
      dayNumberFontSize: isCompactCalendar ? 12 : isTablet ? 15 : 14,
      weekdayFontSize: showWideWeekdays ? 12 : 11,
      dayMetaSlotHeight: showDayCountBadge ? 22 : 10,
      isCompactAgendaCard: !isDesktop && width < 430,
      agendaGroupColumns:
        isDesktop && !selectedDateKey && displayedGroups.length > 1 ? 2 : 1,
      agendaGroupGap: isDenseAgenda ? 12 : 14,
      agendaCardPadding: isDenseAgenda ? (isTablet ? 16 : 14) : isTablet ? 18 : 16,
      agendaRowMinHeight: isDenseAgenda ? (isDesktop ? 94 : 88) : isDesktop ? 120 : 102,
      agendaHeaderGap: isTablet ? 16 : 14,
      agendaIconSize: isDenseAgenda ? 40 : 44,
      agendaTitleFontSize: isTablet ? 16 : 15,
      agendaTitleLineHeight,
      agendaSubtitleLineHeight,
      agendaDescriptionLineHeight,
      agendaSubtitleLines,
      agendaDescriptionLines,
      agendaDescriptionCharLimit: isDenseAgenda
        ? isDesktop
          ? 150
          : 100
        : isDesktop
          ? 210
          : isTablet
            ? 150
            : 115,
      agendaSubtitleMinHeight: agendaSubtitleLineHeight * agendaSubtitleLines,
      agendaDescriptionSlotMinHeight,
      agendaActionColumnMinHeight: isDenseAgenda ? (isDesktop ? 94 : 64) : isDesktop ? 116 : 72,
      agendaPanelMinHeight: isDesktop ? calendarPanelMinHeight : undefined,
      focusPreviewCount: isDesktop ? 3 : 2,
    };
  }, [displayedGroups.length, displayedItemCount, fontScale, selectedDateKey, width]);

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
      : fallbackUpcomingGroups.length
        ? t("deadlineCalendar.nextAvailableSummary")
        : t("deadlineCalendar.noDatedItemsMessage");

  const focusPreviewItems = focusGroup?.items.slice(0, layout.focusPreviewCount) ?? [];
  const focusRelativeLabel = focusGroup ? formatRelativeDate(focusGroup.dueAt, locale) : "";
  const focusSummary = focusGroup
    ? selectedGroup
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
        : fallbackUpcomingGroups.length
          ? t("deadlineCalendar.nextAvailableSummary")
          : t("deadlineCalendar.noDatedItemsMessage")
    : t("deadlineCalendar.noDatedItemsMessage");

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
          <AnimatedIconPressable onPress={back} containerClassName="mb-4 self-start" className="flex-row items-center">
            <MaterialIcons name="arrow-back" size={20} color={placeholderColor} />
            <Text className={`${secondaryTextClass} ml-2`}>{t("general.back")}</Text>
          </AnimatedIconPressable>

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

            <View className="flex-row flex-wrap gap-2 mt-4">
              <View className="px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <Text className="text-emerald-600 text-xs font-semibold">
                  {formatMonthTitle(visibleMonth, locale)}
                </Text>
              </View>
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
                    flexDirection: "row",
                    alignItems: "flex-start",
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

                  <View className="px-3 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
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
                      flexDirection: "row",
                      alignItems: "flex-start",
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
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: 8,
                      justifyContent: layout.isTablet ? "flex-end" : "flex-start",
                    }}
                  >
                    {selectedDateKey ? (
                      <AnimatedChipPressable
                        onPress={() => setSelectedDateKey(null)}
                        className="px-3 py-2 rounded-2xl border border-emerald-500/20"
                      >
                        <Text className={`${secondaryTextClass} text-xs font-semibold`}>
                          {t("deadlineCalendar.showAllDates")}
                        </Text>
                      </AnimatedChipPressable>
                    ) : null}

                    <View className="px-3 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
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
                    onAction={() => setRoadmapLoadAttempt((value) => value + 1)}
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
                            flexDirection: "row",
                            alignItems: "flex-start",
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

                          <View className="px-3 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/15">
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
                                  <View className="flex-row items-center justify-between">
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
