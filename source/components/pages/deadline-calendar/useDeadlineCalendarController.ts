import { useEffect, useMemo, useState } from "react";
import { Alert, Linking } from "react-native";
import { useRouter } from "expo-router";

import { ROUTES } from "@/constants/routes";
import { useAppData } from "@/hooks/use-app-data";
import { useOpportunities } from "@/hooks/use-opportunities";
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
import {
  clamp,
  formatGroupDate,
  formatMonthTitle,
  formatRelativeDate,
} from "@/components/pages/deadline-calendar/deadline-calendar-view-utils";

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

type Translate = (key: string, params?: Record<string, string | number>) => string;

function getMonthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
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

function getLocalDateKey(date: Date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
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
  const todayDateKey = getLocalDateKey();
  return groups.find((group) => group.dateKey >= todayDateKey) ?? groups[0] ?? null;
}

function filterCalendarGroupsForAgenda(
  groups: DeadlineCalendarGroup[],
  includeCalendarRevealOnlyItems: boolean
) {
  if (includeCalendarRevealOnlyItems) return groups;

  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.revealInCalendarOnlyWhenSelected),
    }))
    .filter((group) => group.items.length > 0);
}

function countCalendarGroupItems(groups: DeadlineCalendarGroup[]) {
  return groups.reduce((total, group) => total + group.items.length, 0);
}

function buildMonthGridDays(visibleMonth: Date) {
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
}

type UseDeadlineCalendarControllerInput = {
  t: Translate;
  language: Language;
  width: number;
  fontScale: number;
};

export function useDeadlineCalendarController({
  t,
  language,
  width,
  fontScale,
}: UseDeadlineCalendarControllerInput) {
  const router = useRouter();
  const { state, isHydrated } = useAppData();
  const { matchedOpportunities, isHydrated: areOpportunitiesHydrated } =
    useOpportunities();

  const user = state.user;
  const userId = user?.uid ?? "";
  const locale = LANGUAGE_TO_LOCALE[language] ?? "en-US";
  const [roadmap, setRoadmap] = useState<UserRoadmapDocument | null>(null);
  const [isRoadmapLoading, setIsRoadmapLoading] = useState(false);
  const [roadmapLoadError, setRoadmapLoadError] = useState<string | null>(null);
  const [roadmapLoadAttempt, setRoadmapLoadAttempt] = useState(0);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const todayDateKey = useMemo(() => getLocalDateKey(), []);

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
          route: ROUTES.calendar,
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
    const visibleUpcomingWindowGroups = filterCalendarGroupsForAgenda(
      upcomingWindowGroups,
      false
    );
    const visibleHistoricalGroups = filterCalendarGroupsForAgenda(
      groups.filter((group) => group.dateKey < todayDateKey),
      false
    );
    setVisibleMonth((current) => {
      const targetGroup =
        visibleUpcomingWindowGroups[0] ??
        upcomingWindowGroups[0] ??
        visibleHistoricalGroups[visibleHistoricalGroups.length - 1] ??
        groups[groups.length - 1] ??
        null;
      const target = targetGroup
        ? getMonthStart(new Date(targetGroup.dueAt))
        : getMonthStart(new Date());
      if (
        current.getFullYear() === target.getFullYear() &&
        current.getMonth() === target.getMonth()
      ) {
        return current;
      }
      return target;
    });
  }, [groups, todayDateKey]);

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

  const monthAgendaGroups = useMemo(
    () => filterCalendarGroupsForAgenda(monthGroups, false),
    [monthGroups]
  );

  const fallbackUpcomingGroups = useMemo(
    () =>
      filterCalendarGroupsForAgenda(
        deadlineCalendarService.filterUpcomingGroups(
          groups,
          UPCOMING_DEADLINE_WINDOW_DAYS
        ),
        false
      )
        .slice(0, 8),
    [groups]
  );

  const fallbackHistoricalGroups = useMemo(
    () =>
      filterCalendarGroupsForAgenda(
        groups.filter((group) => group.dateKey < todayDateKey),
        false
      )
        .slice(-8)
        .reverse(),
    [groups, todayDateKey]
  );

  const fallbackAgendaGroups = fallbackUpcomingGroups.length
    ? fallbackUpcomingGroups
    : fallbackHistoricalGroups;

  const monthItemCount = useMemo(
    () => countCalendarGroupItems(monthGroups),
    [monthGroups]
  );

  const monthAgendaItemCount = useMemo(
    () => countCalendarGroupItems(monthAgendaGroups),
    [monthAgendaGroups]
  );

  const displayedGroups = useMemo(() => {
    if (selectedDateKey) {
      return groups.filter((group) => group.dateKey === selectedDateKey);
    }
    if (monthGroups.length) return monthAgendaGroups;
    return fallbackAgendaGroups;
  }, [fallbackAgendaGroups, groups, monthAgendaGroups, monthGroups.length, selectedDateKey]);

  const displayedItemCount = useMemo(
    () => countCalendarGroupItems(displayedGroups),
    [displayedGroups]
  );

  const dateCountByKey = useMemo(() => {
    const counts = new Map<string, number>();
    for (const group of monthGroups) {
      counts.set(group.dateKey, group.items.length);
    }
    return counts;
  }, [monthGroups]);

  const monthGridDays = useMemo(() => buildMonthGridDays(visibleMonth), [visibleMonth]);

  const handleOpenEntry = async (item: DeadlineCalendarEntry) => {
    try {
      if (item.target.type === "college") {
        router.push(
          ROUTES.collegeDetail(item.target.collegeId, {
            returnTo: String(ROUTES.calendar),
          })
        );
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

  const selectedGroup = selectedDateKey ? displayedGroups[0] ?? null : null;
  const monthFocusGroup = useMemo(
    () => findUpcomingGroup(monthAgendaGroups),
    [monthAgendaGroups]
  );
  const focusGroup = selectedGroup ?? monthFocusGroup ?? fallbackAgendaGroups[0] ?? null;

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
      : fallbackUpcomingGroups.length
        ? t("deadlineCalendar.upcomingDeadlines")
        : fallbackHistoricalGroups.length
          ? t("deadlineCalendar.pastDeadlines")
          : t("deadlineCalendar.upcomingDeadlines");

  const selectedItemLabel =
    displayedItemCount === 1
      ? t("deadlineCalendar.itemSingular")
      : t("deadlineCalendar.itemPlural");
  const monthItemLabel =
    monthItemCount === 1
      ? t("deadlineCalendar.itemSingular")
      : t("deadlineCalendar.itemPlural");
  const monthAgendaItemLabel =
    monthAgendaItemCount === 1
      ? t("deadlineCalendar.itemSingular")
      : t("deadlineCalendar.itemPlural");
  const monthAgendaDateLabel =
    monthAgendaGroups.length === 1
      ? t("deadlineCalendar.dateSingular")
      : t("deadlineCalendar.datePlural");

  const agendaSubtitle = selectedGroup
    ? t("deadlineCalendar.selectedDateSummary", {
        count: displayedItemCount,
        itemLabel: selectedItemLabel,
      })
    : monthAgendaGroups.length
      ? t("deadlineCalendar.monthSummary", {
          itemCount: monthAgendaItemCount,
          itemLabel: monthAgendaItemLabel,
          dateCount: monthAgendaGroups.length,
          dateLabel: monthAgendaDateLabel,
        })
      : monthGroups.length
        ? t("deadlineCalendar.selectDateToRevealMessage")
      : fallbackUpcomingGroups.length
        ? t("deadlineCalendar.nextAvailableSummary")
        : fallbackHistoricalGroups.length
          ? `${displayedItemCount} ${selectedItemLabel} from recent past dates`
        : t("deadlineCalendar.noDatedItemsMessage");

  const focusPreviewItems = focusGroup?.items.slice(0, layout.focusPreviewCount) ?? [];
  const focusRelativeLabel = focusGroup ? formatRelativeDate(focusGroup.dueAt, locale, t) : "";
  const focusSummary = focusGroup
    ? selectedGroup
      ? t("deadlineCalendar.selectedDateSummary", {
          count: displayedItemCount,
          itemLabel: selectedItemLabel,
        })
      : monthAgendaGroups.length
        ? t("deadlineCalendar.monthSummary", {
            itemCount: monthAgendaItemCount,
            itemLabel: monthAgendaItemLabel,
            dateCount: monthAgendaGroups.length,
            dateLabel: monthAgendaDateLabel,
          })
        : monthGroups.length
          ? t("deadlineCalendar.selectDateToRevealMessage")
        : fallbackUpcomingGroups.length
          ? t("deadlineCalendar.nextAvailableSummary")
          : fallbackHistoricalGroups.length
            ? `${displayedItemCount} ${selectedItemLabel} from recent past dates`
          : t("deadlineCalendar.noDatedItemsMessage")
    : t("deadlineCalendar.noDatedItemsMessage");

  const weekdayLabels = useMemo(
    () => buildWeekdayLabels(locale, layout.showWideWeekdays),
    [layout.showWideWeekdays, locale]
  );

  return {
    isHydrated,
    areOpportunitiesHydrated,
    roadmap,
    isRoadmapLoading,
    roadmapLoadError,
    retryRoadmapLoad: () => setRoadmapLoadAttempt((value) => value + 1),
    locale,
    todayDateKey,
    selectedDateKey,
    setSelectedDateKey,
    visibleMonth,
    setVisibleMonth,
    calendarEntries,
    groups,
    monthGroups,
    monthAgendaGroups,
    fallbackUpcomingGroups,
    fallbackHistoricalGroups,
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
  };
}
