import { useState, useEffect, useMemo, useCallback } from "react";
import { View, Text, ScrollView, useWindowDimensions, Linking, Image, Pressable, type DimensionValue } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ROUTES } from "@/constants/routes";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAppLanguage } from "@/hooks/use-app-language";
import { useAppData } from "@/hooks/use-app-data";
import { useOpportunities } from "@/hooks/use-opportunities";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import {
  AnimatedCardPressable,
  AnimatedChipPressable,
} from "@/components/ui/AnimatedPressables";
import {
  deadlineCalendarService,
  type DeadlineCalendarEntry,
} from "@/services/deadlines/deadline-calendar.service";
import { errorLoggingService } from "@/services/logging/error-logging.service";
import {
  roadmapService,
  type UserRoadmapDocument,
} from "@/services/planning/roadmap.service";

type HomeTourStep = {
  id: string;
  title: string;
  description: string;
  x: number;
  y: number;
};

const TRANSFER_PLANNER_CURRENT_COURSES_FIELD = "transferPlannerCurrentCoursesByPath";

const DESKTOP_HOME_MIN_WIDTH = 960;
const PHONE_FALLBACK_ASPECT_RATIO = 1.5;

function formatImportantDate(value: string | null, fallback = "Coming soon") {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  try {
    const options: Intl.DateTimeFormatOptions = {
      month: "short",
      day: "numeric",
    };
    if (parsed.getFullYear() !== new Date().getFullYear()) {
      options.year = "numeric";
    }
    return new Intl.DateTimeFormat(undefined, options).format(parsed);
  } catch {
    return value;
  }
}

function formatGpaDisplay(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const match = raw.match(/-?\d+(?:\.\d+)?/);
  if (!match) return raw;
  const num = Number.parseFloat(match[0]);
  if (!Number.isFinite(num)) return raw;
  const clamped = Math.max(0, Math.min(num, 4.0));
  const truncated = Math.floor(clamped * 100) / 100;
  return truncated.toFixed(2).replace(/\.0+$|0+$/g, '');
}

function getDeadlineOpportunityId(entry: DeadlineCalendarEntry) {
  if (entry.target.type === "resources") return entry.target.opportunityId;
  const opportunityPrefix = "opportunity:";
  return entry.id.startsWith(opportunityPrefix)
    ? entry.id.slice(opportunityPrefix.length)
    : null;
}

export default function HomePage() {
  const router = useRouter();
  const { isDark, isGreen, isLight } = useAppTheme();
  const { t } = useAppLanguage();
  const { isHydrated, state, setOnboardingSeen } = useAppData();
  const { matchedOpportunities, setOpportunityDone } = useOpportunities();
  const { getScrollContentPadding } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight, fontScale = 1 } = useWindowDimensions();

  const user = state.user;
  const isPhoneLikeViewport = screenHeight >= screenWidth * PHONE_FALLBACK_ASPECT_RATIO;
  const isDesktopHome = screenWidth >= DESKTOP_HOME_MIN_WIDTH && !isPhoneLikeViewport;
  const unfinishedRecommendedOpportunities = useMemo(
    () => matchedOpportunities.filter((opportunity) => !opportunity.isDone),
    [matchedOpportunities]
  );
  const [desktopRoadmap, setDesktopRoadmap] = useState<UserRoadmapDocument | null>(null);
  const [pendingDeadlineIds, setPendingDeadlineIds] = useState<Set<string>>(() => new Set());
  const [tourStepIndex, setTourStepIndex] = useState(0);

  const capitalizedName = user?.name 
    ? user.name.split(' ')[0].charAt(0).toUpperCase() + user.name.split(' ')[0].slice(1).toLowerCase()
    : t("home.student");

  const openCalendar = useCallback(() => {
    router.push(
      {
        pathname: ROUTES.calendar,
        params: { returnTo: ROUTES.root },
      } as never
    );
  }, [router]);
  const desktopRoadmapSeed = useMemo(
    () =>
      roadmapService.buildRoadmapSeedInput({
        major: user?.major,
        gpa: user?.gpa,
        questionnaireAnswers: state.questionnaireAnswers,
        targetSchools: state.savedColleges.map((college) => college.name),
        documents: {
          ...(user?.transcript ? { transcripts: { fileUrl: user.transcript } } : {}),
        },
      }),
    [state.questionnaireAnswers, state.savedColleges, user?.gpa, user?.major, user?.transcript]
  );

  const textClass = isDark ? "text-white" : isGreen ? "text-white" : isLight ? "text-emerald-900" : "text-gray-900";
  const secondaryTextClass = isDark ? "text-gray-400" : isGreen ? "text-emerald-100" : isLight ? "text-emerald-700" : "text-gray-600";
  const guestCtaCardClass = isLight ? "bg-emerald-100 border border-emerald-200" : isDark ? "bg-emerald-500 border" : "bg-emerald-500";
  const guestCtaCardStyle = isDark ? { backgroundColor: "#00572b", borderColor: "#00753e" } : undefined;
  const guestCtaIconBgClass = isLight ? "bg-emerald-500/10 border border-emerald-200" : isDark ? "bg-white/10 border border-white/10" : "bg-emerald-900/10";
  const guestCtaIconColor = isLight ? "#1f8a5d" : isDark ? "#8cd19e" : "#001f0f";
  const guestCtaTitleClass = isLight ? "text-emerald-900" : "text-white";
  const guestCtaBodyClass = isLight ? "text-emerald-800" : "text-emerald-100";
  const guestCtaPrimaryButtonClass = isLight ? "bg-emerald-500" : "bg-emerald-900";
  const guestCtaPrimaryTextClass = "text-white";
  const dashboardPanelClass = isDark
    ? "bg-gray-950/60 border-gray-800"
    : isGreen
      ? "bg-emerald-950/30 border-emerald-700"
      : isLight
        ? "bg-white border-emerald-200"
        : "bg-white border-gray-200";
  const dashboardItemClass = isDark
    ? "bg-gray-900/90 border-gray-800"
    : isGreen
      ? "bg-emerald-900/80 border-emerald-800"
      : isLight
        ? "bg-emerald-50/70 border-emerald-200"
        : "bg-gray-50 border-gray-200";
  const dashboardMutedClass = isDark
    ? "bg-gray-900/80 border-gray-800"
    : isGreen
      ? "bg-emerald-900/70 border-emerald-800"
      : isLight
        ? "bg-emerald-50 border-emerald-200"
        : "bg-gray-50 border-gray-200";
  const dashboardBadgeClass = isDark || isGreen
    ? "bg-emerald-500/10 border border-emerald-500/20"
    : "bg-emerald-50 border border-emerald-200";
  const dashboardBadgeTextClass = isDark || isGreen ? "text-emerald-100" : "text-emerald-700";
  const effectiveFontScale = Math.max(1, fontScale);
  const contentMaxWidth = isDesktopHome ? 1280 : 448;
  const desktopHorizontalPadding = isDesktopHome && screenWidth < 1100 ? 24 : isDesktopHome ? 32 : 24;
  const scrollContentPadding = getScrollContentPadding({
    includeTopInset: true,
    includeBottomTabClearance: true,
    extraBottom: isDesktopHome ? 24 : 0,
  });
  const desktopColumnsShouldStack = isDesktopHome && (screenWidth < 1120 || effectiveFontScale > 1.15);
  const dashboardSectionWidth = desktopColumnsShouldStack
    ? { width: "100%" as DimensionValue }
    : { width: "48.8%" as DimensionValue };
  const mobileSnapshotStatsShouldStack = screenWidth < 390 || effectiveFontScale > 1.05;
  const renderGuestAccountCta = ({ desktop }: { desktop: boolean }) => (
    <View
      style={
        desktop
          ? {
              flex: 1,
              justifyContent: "center",
              gap: 24,
              minHeight: "100%",
            }
          : undefined
      }
    >
      <View className={`flex-row items-start ${desktop ? "gap-4" : "gap-3"}`}>
        <View
          className={`${desktop ? "rounded-[24px]" : "rounded-full"} ${guestCtaIconBgClass} items-center justify-center ${desktop ? "" : "mt-1"}`}
          style={desktop ? { width: 76, height: 76 } : undefined}
        >
          <Ionicons name="person-add" size={desktop ? 28 : 20} color={guestCtaIconColor} />
        </View>

        <View className="flex-1">
          <Text className={`font-semibold ${guestCtaTitleClass} ${desktop ? "text-2xl" : "text-base"} mb-1`}>
            {t("home.createAccount")}
          </Text>
          <Text className={`${guestCtaBodyClass} text-sm ${desktop ? "leading-6" : ""}`}>
            {t("home.signUpMessage")}
          </Text>
        </View>
      </View>

      <View className={`flex-row gap-2 ${desktop ? "mt-5" : "mt-3"}`}>
        <AnimatedChipPressable
          onPress={() => router.push(ROUTES.login)}
          className={`${guestCtaPrimaryButtonClass} rounded-lg py-2 items-center justify-center`}
          containerStyle={{ flex: 1 }}
        >
          <Text className={`${guestCtaPrimaryTextClass} font-semibold text-sm`}>{t("home.signUp")}</Text>
        </AnimatedChipPressable>
      </View>
    </View>
  );
  useEffect(() => {
    let cancelled = false;

    if (!isHydrated || !user?.uid) {
      setDesktopRoadmap(null);
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      try {
        const roadmap = await roadmapService.getUserRoadmap(user.uid, desktopRoadmapSeed);
        if (!cancelled) {
          setDesktopRoadmap(roadmap);
        }
      } catch (error) {
        if (!cancelled) {
          setDesktopRoadmap(null);
        }
        void errorLoggingService.captureException(error, {
          category: "app",
          operation: "load-homepage-roadmap",
          severity: "warn",
          handled: true,
          source: "HomePage",
          screen: "HomePage",
          route: "/",
          metadata: {
            isDesktopHome,
            userId: user.uid,
          },
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [desktopRoadmapSeed, isDesktopHome, isHydrated, user?.uid]);

  const desktopCurrentCourses = useMemo(
    () => desktopRoadmap?.profileSnapshot.currentCourses ?? [],
    [desktopRoadmap?.profileSnapshot.currentCourses]
  );
  const desktopRecommendedCourses = useMemo(
    () => desktopRoadmap?.profileSnapshot.recommendedCourses ?? [],
    [desktopRoadmap?.profileSnapshot.recommendedCourses]
  );
  const desktopCoursePlanningDeadline = useMemo(
    () => desktopRoadmap?.profileSnapshot.deadline?.trim() || null,
    [desktopRoadmap?.profileSnapshot.deadline]
  );
  const plannerCurrentCourses = useMemo(() => {
    const rawValue = state.questionnaireAnswers?.[TRANSFER_PLANNER_CURRENT_COURSES_FIELD];
    if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
      return [] as string[];
    }

    const seen = new Set<string>();
    const merged: string[] = [];

    for (const value of Object.values(rawValue)) {
      if (!Array.isArray(value)) continue;

      for (const entry of value) {
        const normalized = String(entry ?? "").trim();
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        merged.push(normalized);
      }
    }

    return merged;
  }, [state.questionnaireAnswers]);
  const linkedCurrentCourses = useMemo(() => {
    const seen = new Set<string>();
    const merged: string[] = [];

    for (const source of [desktopCurrentCourses, plannerCurrentCourses]) {
      for (const entry of source) {
        const normalized = String(entry ?? "").trim();
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        merged.push(normalized);
      }
    }

    return merged;
  }, [desktopCurrentCourses, plannerCurrentCourses]);
  const shouldShowCurrentCoursesDashboardPanel = linkedCurrentCourses.length > 0;
  const shouldShowRecommendedNextDashboardPanel =
    desktopRecommendedCourses.length > 0 || !!desktopCoursePlanningDeadline;
  const desktopProfileName = user?.name?.trim() || t("home.student");
  const desktopProfileMajor = user?.major?.trim() || desktopRoadmap?.profileSnapshot.major?.trim() || t("home.undecided");
  const desktopProfileGpaRaw = user?.gpa?.trim() || desktopRoadmap?.profileSnapshot.gpa?.trim() || "";
  const desktopProfileGpa = desktopProfileGpaRaw ? formatGpaDisplay(desktopProfileGpaRaw) : t("general.notSpecified");
  const desktopCombinedDeadlineEntries = useMemo(
    () =>
      deadlineCalendarService
        .filterUpcomingEntries(
          deadlineCalendarService.buildEntries({
            roadmap: desktopRoadmap,
            opportunities: unfinishedRecommendedOpportunities,
          })
        )
        .slice(0, 5),
    [desktopRoadmap, unfinishedRecommendedOpportunities]
  );
  const desktopNextDeadlineEntry = useMemo(
    () => desktopCombinedDeadlineEntries[0] ?? null,
    [desktopCombinedDeadlineEntries]
  );

  const handleOpenDeadlineEntry = useCallback(async (item: DeadlineCalendarEntry) => {
    try {
      if (item.target.type === "college") {
        router.push(
          ROUTES.collegeDetail(item.target.collegeId, {
            returnTo: ROUTES.root,
          })
        );
        return;
      }

      if (item.target.type === "roadmap") {
        openCalendar();
        return;
      }

      if (item.target.type === "resources") {
        router.push(ROUTES.tabsResources);
        return;
      }

      await Linking.openURL(item.target.url);
    } catch (error) {
      void errorLoggingService.captureException(error, {
        category: "app",
        operation: "open-home-deadline-entry",
        severity: "warn",
        handled: true,
        source: "HomePage",
        screen: "HomePage",
        route: "/",
        metadata: {
          entryId: item.id,
          targetType: item.target.type,
        },
      });
      if (item.target.type === "roadmap") {
        openCalendar();
        return;
      }
      router.push(ROUTES.tabsResources);
    }
  }, [openCalendar, router]);

  const handleToggleDeadlineEntry = useCallback(async (item: DeadlineCalendarEntry) => {
    setPendingDeadlineIds((current) => new Set(current).add(item.id));

    try {
      if (item.target.type === "roadmap") {
        if (!desktopRoadmap) return;

        const nextRoadmap = roadmapService.setTaskCompletion(
          desktopRoadmap,
          item.target.sectionId,
          item.target.taskId,
          !item.isDone
        );
        setDesktopRoadmap(nextRoadmap);

        const roadmapUserId = user?.uid ?? nextRoadmap.userId;
        if (roadmapUserId) {
          const savedRoadmap = await roadmapService.saveUserRoadmap(roadmapUserId, nextRoadmap);
          setDesktopRoadmap(savedRoadmap);
        }
        return;
      }

      const opportunityId = getDeadlineOpportunityId(item);
      if (opportunityId) {
        await setOpportunityDone(opportunityId, !item.isDone);
      }
    } catch (error) {
      void errorLoggingService.captureException(error, {
        category: "app",
        operation: "toggle-home-deadline-entry",
        severity: "warn",
        handled: true,
        source: "HomePage",
        screen: "HomePage",
        route: "/",
        metadata: {
          entryId: item.id,
          entryKind: item.kind,
          targetType: item.target.type,
        },
      });
    } finally {
      setPendingDeadlineIds((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
    }
  }, [desktopRoadmap, setOpportunityDone, user?.uid]);

  const shouldShowTour = Boolean(user && !user.isGuest && user.hasSeenOnboarding !== true);
  const tourCardWidth = Math.min(448, Math.max(280, screenWidth - 32));
  const tourCardLeft = (screenWidth - tourCardWidth) / 2;
  const topAnchor = insets.top + 40;
  const tabAnchorY = screenHeight - insets.bottom - 56;

  const tourSteps = useMemo<HomeTourStep[]>(() => [
    {
      id: "planning",
      title: "Planning Snapshot",
      description: "This area tracks transfer tasks, deadlines, and your next steps in one place.",
      x: tourCardLeft + tourCardWidth * 0.5,
      y: topAnchor + 360,
    },
    {
      id: "tab-home",
      title: "Home",
      description: "Home is your main page for tasks, deadlines, and your planning snapshot.",
      x: screenWidth * 0.125,
      y: tabAnchorY,
    },
    {
      id: "tab-resources",
      title: "Resources",
      description: "Resources gives you useful links, tools, and planning references.",
      x: screenWidth * 0.375,
      y: tabAnchorY,
    },
    {
      id: "tab-profile",
      title: "Profile",
      description: "Profile contains your academic details used for personalization.",
      x: screenWidth * 0.625,
      y: tabAnchorY,
    },
    {
      id: "tab-settings",
      title: "Settings",
      description: "Settings lets you manage preferences, language, account actions, and legal pages.",
      x: screenWidth * 0.875,
      y: tabAnchorY,
    },
  ], [screenWidth, tabAnchorY, tourCardLeft, tourCardWidth, topAnchor]);

  const activeTourStep = tourSteps[Math.min(tourStepIndex, tourSteps.length - 1)];
  const bubbleWidth = Math.min(360, Math.max(260, screenWidth - 24));
  const bubbleHeight = Math.max(150, Math.round(136 * effectiveFontScale));
  const preferBubbleTop = activeTourStep ? activeTourStep.y > screenHeight * 0.45 : false;
  const bubbleTop = activeTourStep
    ? preferBubbleTop
      ? Math.max(insets.top + 12, activeTourStep.y - bubbleHeight - 36)
      : Math.min(screenHeight - bubbleHeight - insets.bottom - 20, activeTourStep.y + 26)
    : insets.top + 12;
  const bubbleLeft = activeTourStep
    ? Math.max(12, Math.min(activeTourStep.x - bubbleWidth / 2, screenWidth - bubbleWidth - 12))
    : 12;
  const pointerOffset = activeTourStep
    ? Math.max(20, Math.min(activeTourStep.x - bubbleLeft - 8, bubbleWidth - 28))
    : 24;

  const completeTour = async () => {
    await setOnboardingSeen(true);
    setTourStepIndex(0);
  };

  const advanceTour = async () => {
    if (tourStepIndex >= tourSteps.length - 1) {
      await completeTour();
      return;
    }
    setTourStepIndex((prev) => prev + 1);
  };

  const renderDeadlineCheckbox = (entry: DeadlineCalendarEntry) => {
    const isPending = pendingDeadlineIds.has(entry.id);
    const isChecked = entry.isDone;

    return (
      <Pressable
        onPress={(event) => {
          event.stopPropagation();
          void handleToggleDeadlineEntry(entry);
        }}
        disabled={isPending}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isChecked, disabled: isPending }}
        accessibilityLabel={`${isChecked ? "Mark deadline unfinished" : "Mark deadline done"}: ${entry.title}`}
        className={`w-11 h-11 rounded-xl border items-center justify-center ${
          isChecked
            ? "bg-emerald-500 border-emerald-500"
            : "bg-emerald-500/10 border-emerald-500/30"
        }`}
        style={isPending ? { opacity: 0.55 } : undefined}
      >
        <Ionicons
          name={isChecked ? "checkbox" : "square-outline"}
          size={22}
          color={isChecked ? "#FFFFFF" : "#008f4e"}
        />
      </Pressable>
    );
  };

  const renderDeadlinePanel = (
    entries: DeadlineCalendarEntry[]
  ) => (
    <View className={`${dashboardPanelClass} border rounded-[28px] p-5`} style={{ width: "100%" as DimensionValue }}>
      <View className="flex-row items-start mb-4">
        <View className="w-11 h-11 rounded-2xl bg-emerald-500/10 items-center justify-center mr-3">
          <Ionicons name="calendar-outline" size={18} color="#008f4e" />
        </View>
        <View className="flex-1">
          <Text className={`${textClass} text-lg font-semibold`}>Upcoming deadlines</Text>
          <Text className={`${secondaryTextClass} text-sm mt-1`}>
            School dates, scholarships, and other important deadlines coming up for you.
          </Text>
        </View>
      </View>

      {entries.length ? (
        <View className="gap-3">
          {entries.map((entry) => (
            <AnimatedCardPressable
              key={entry.id}
              onPress={() => {
                void handleOpenDeadlineEntry(entry);
              }}
              className={`border rounded-3xl p-4 ${dashboardItemClass}`}
            >
              <View className="flex-row items-start">
                <View className="flex-1 min-w-0 pr-3">
                  <Text className={`${textClass} font-semibold`} numberOfLines={2}>
                    {entry.title}
                  </Text>
                  <Text className={`${secondaryTextClass} text-sm mt-1`} numberOfLines={2}>
                    {entry.subtitle}
                  </Text>
                  <View className="flex-row flex-wrap items-center gap-2 mt-3">
                    <View className={`px-3 py-1.5 rounded-full ${dashboardBadgeClass}`}>
                      <Text className={`${dashboardBadgeTextClass} text-xs font-semibold`}>
                        {entry.kind === "roadmap_task"
                          ? "School"
                          : entry.kind === "scholarship"
                            ? "Scholarship"
                            : entry.kind === "internship"
                              ? "Internship"
                              : "College"}
                      </Text>
                    </View>
                    <Text className="text-emerald-500 text-xs font-semibold">{t("home.openAction")}</Text>
                  </View>
                </View>
                <View className="items-end gap-3">
                  {renderDeadlineCheckbox(entry)}
                  <View className={`px-3 py-1.5 rounded-full ${dashboardBadgeClass}`}>
                    <Text className={`${dashboardBadgeTextClass} text-xs font-semibold`}>
                      {formatImportantDate(entry.dueAt)}
                    </Text>
                  </View>
                </View>
              </View>
            </AnimatedCardPressable>
          ))}
        </View>
      ) : (
        <View className={`border rounded-3xl p-4 ${dashboardMutedClass}`}>
          <Text className={`${textClass} font-semibold`}>No deadlines yet</Text>
          <Text className={`${secondaryTextClass} text-sm mt-1`}>
            Add dates to your planner or finish your profile to see more deadlines here.
          </Text>
        </View>
      )}
    </View>
  );

  const renderNextDeadlineCard = (entry: DeadlineCalendarEntry) => (
    <AnimatedCardPressable
      onPress={() => {
        void handleOpenDeadlineEntry(entry);
      }}
      className={`border rounded-3xl p-4 ${dashboardItemClass}`}
    >
      <View className="flex-row items-start">
        <View className="flex-1 min-w-0 pr-3">
          <Text className={`${textClass} font-semibold`} numberOfLines={2}>
            {entry.title}
          </Text>
          <Text className={`${secondaryTextClass} text-sm mt-1`} numberOfLines={2}>
            {entry.subtitle}
          </Text>
          <Text className="text-emerald-500 text-xs font-semibold mt-3">
            {t("home.openAction")}
          </Text>
        </View>
        <View className="items-end gap-3">
          {renderDeadlineCheckbox(entry)}
          <View className={`px-3 py-1.5 rounded-full ${dashboardBadgeClass}`}>
            <Text className={`${dashboardBadgeTextClass} text-xs font-semibold`}>
              {formatImportantDate(entry.dueAt)}
            </Text>
          </View>
        </View>
      </View>
    </AnimatedCardPressable>
  );

  const renderCurrentCoursesDashboardPanel = ({ fullWidth = false }: { fullWidth?: boolean } = {}) => {
    if (!shouldShowCurrentCoursesDashboardPanel) return null;

    return (
      <View
        className={`${dashboardPanelClass} border rounded-[28px] p-5`}
        style={fullWidth ? { width: "100%" } : dashboardSectionWidth}
      >
        <View className="flex-row items-start mb-4">
          <View className="w-11 h-11 rounded-2xl bg-emerald-500/10 items-center justify-center mr-3">
            <Ionicons name="school-outline" size={18} color="#008f4e" />
          </View>
          <View className="flex-1">
            <Text className={`${textClass} text-lg font-semibold`}>{t("roadmap.currentCourses")}</Text>
            <Text className={`${secondaryTextClass} text-sm mt-1`}>
              {user?.transcript ? t("home.currentCoursesWithTranscript") : t("home.currentCoursesWithoutTranscript")}
            </Text>
          </View>
        </View>

        <View className="gap-3">
          {linkedCurrentCourses.slice(0, 5).map((course) => (
            <View
              key={course}
              className={`border rounded-3xl p-4 ${dashboardItemClass}`}
            >
              <Text className={`${textClass} font-medium`}>{course}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderRecommendedNextDashboardPanel = ({ fullWidth = false }: { fullWidth?: boolean } = {}) => {
    if (!shouldShowRecommendedNextDashboardPanel) return null;

    return (
      <View
        className={`${dashboardPanelClass} border rounded-[28px] p-5`}
        style={fullWidth ? { width: "100%" } : dashboardSectionWidth}
      >
        <View className="flex-row items-start mb-4">
          <View className="w-11 h-11 rounded-2xl bg-sky-500/10 items-center justify-center mr-3">
            <Ionicons name="navigate-outline" size={18} color="#0284c7" />
          </View>
          <View className="flex-1">
            <Text className={`${textClass} text-lg font-semibold`}>Recommended next</Text>
            <Text className={`${secondaryTextClass} text-sm mt-1`}>
              Courses the planner suggests lining up after what you are taking now.
            </Text>
          </View>
        </View>

        <View className="gap-4">
          {desktopCoursePlanningDeadline ? (
            <View className={`border rounded-3xl p-4 ${isDark ? "border-amber-800 bg-amber-950/40" : "border-amber-200 bg-amber-50"}`}>
              <Text className={`${textClass} font-semibold`}>Next class planning target</Text>
              <Text className={`${secondaryTextClass} text-sm mt-1`}>
                Aim to get class sign-up ready by {formatImportantDate(desktopCoursePlanningDeadline)}.
              </Text>
            </View>
          ) : null}

          {desktopRecommendedCourses.length ? (
            <View className="flex-row flex-wrap gap-2">
              {desktopRecommendedCourses.slice(0, 6).map((course) => (
                <View
                  key={course}
                  className={`rounded-full px-3 py-2 border ${isDark ? "border-sky-900 bg-sky-950/30" : "border-sky-200 bg-sky-50"}`}
                >
                  <Text className={`${isDark ? "text-sky-100" : "text-sky-800"} text-sm`}>
                    {course}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  const renderMobileSnapshotPanel = () => {
    if (!user) return null;

    return (
      <View
        className={`${user.isGuest ? guestCtaCardClass : dashboardPanelClass} border rounded-[28px] p-5`}
        style={user.isGuest ? guestCtaCardStyle : undefined}
      >
        {user.isGuest ? (
          renderGuestAccountCta({ desktop: false })
        ) : (
          <>
            <View className="flex-row items-center flex-1 min-w-0">
              <View
                className={`rounded-[22px] overflow-hidden items-center justify-center ${user.avatar ? "" : "bg-emerald-500/10"}`}
                style={{ width: 64, height: 64 }}
              >
                {user.avatar ? (
                  <Image source={{ uri: user.avatar }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                ) : (
                  <Text className="text-emerald-500 text-xl font-semibold">
                    {desktopProfileName.charAt(0).toUpperCase() || "S"}
                  </Text>
                )}
              </View>
              <View className="ml-4 flex-1 min-w-0">
                <Text className={`${secondaryTextClass} text-xs uppercase tracking-[1px] mb-2`}>{t("home.yourProfile")}</Text>
                <Text className={`${textClass} text-xl font-semibold`} numberOfLines={1}>
                  {desktopProfileName}
                </Text>
                <Text className={`${secondaryTextClass} text-sm mt-1`} numberOfLines={2}>
                  {t("home.desktopSnapshot")}
                </Text>
              </View>
            </View>

            <View
              className="mt-5"
              style={
                mobileSnapshotStatsShouldStack
                  ? { gap: 12 }
                  : { flexDirection: "row", gap: 12 }
              }
            >
              <View
                className={`border rounded-3xl p-4 ${dashboardItemClass}`}
                style={mobileSnapshotStatsShouldStack ? undefined : { flex: 1, minWidth: 0 }}
              >
                <Text className={`${secondaryTextClass} text-xs uppercase tracking-[0.8px]`}>{t("home.major")}</Text>
                <Text className={`${textClass} text-base font-semibold mt-2`} numberOfLines={2}>
                  {desktopProfileMajor}
                </Text>
              </View>
              <View
                className={`border rounded-3xl p-4 ${dashboardItemClass}`}
                style={mobileSnapshotStatsShouldStack ? undefined : { flex: 1, minWidth: 0 }}
              >
                <Text className={`${secondaryTextClass} text-xs uppercase tracking-[0.8px]`}>{t("home.gpa")}</Text>
                <Text className={`${textClass} text-base font-semibold mt-2`}>
                  {desktopProfileGpa}
                </Text>
              </View>
            </View>
          </>
        )}
      </View>
    );
  };

  const desktopDashboard = isDesktopHome ? (
    <>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 24,
          alignItems: "stretch",
        }}
      >
        <View
          className={`${user?.isGuest ? guestCtaCardClass : dashboardPanelClass} border rounded-[28px] p-5`}
          style={[dashboardSectionWidth, user?.isGuest ? guestCtaCardStyle : undefined]}
        >
          {user?.isGuest ? (
            renderGuestAccountCta({ desktop: true })
          ) : (
            <>
              <View className="flex-row items-start justify-between gap-4">
                <View className="flex-row items-center flex-1 min-w-0">
                  <View
                    className={`rounded-[24px] overflow-hidden items-center justify-center ${user?.avatar ? "" : "bg-emerald-500/10"}`}
                    style={{ width: 76, height: 76 }}
                  >
                    {user?.avatar ? (
                      <Image source={{ uri: user.avatar }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                    ) : (
                      <Text className="text-emerald-500 text-2xl font-semibold">
                        {desktopProfileName.charAt(0).toUpperCase() || "S"}
                      </Text>
                    )}
                  </View>
                  <View className="ml-4 flex-1 min-w-0">
                    <Text className={`${secondaryTextClass} text-xs uppercase tracking-[1px] mb-2`}>{t("home.yourProfile")}</Text>
                    <Text className={`${textClass} text-2xl font-semibold`} numberOfLines={1}>
                      {desktopProfileName}
                    </Text>
                    <Text className={`${secondaryTextClass} text-sm mt-1`} numberOfLines={1}>
                      {t("home.desktopSnapshot")}
                    </Text>
                  </View>
                </View>
              </View>

              <View className="gap-3 mt-5">
                <View className={`border rounded-3xl p-4 ${dashboardItemClass}`}>
                  <Text className={`${secondaryTextClass} text-xs uppercase tracking-[0.8px]`}>{t("home.major")}</Text>
                  <Text className={`${textClass} text-base font-semibold mt-2`}>{desktopProfileMajor}</Text>
                </View>
                <View className={`border rounded-3xl p-4 ${dashboardItemClass}`}>
                  <Text className={`${secondaryTextClass} text-xs uppercase tracking-[0.8px]`}>{t("home.gpa")}</Text>
                  <Text className={`${textClass} text-base font-semibold mt-2`}>{desktopProfileGpa}</Text>
                </View>
              </View>
            </>
          )}
        </View>

        <View className={`${dashboardPanelClass} border rounded-[28px] p-5`} style={dashboardSectionWidth}>
          <View className="flex-row items-start mb-4">
            <View className="w-11 h-11 rounded-2xl bg-emerald-500/10 items-center justify-center mr-3">
              <Ionicons name="calendar-outline" size={18} color="#008f4e" />
            </View>
            <View className="flex-1">
              <Text className={`${textClass} text-lg font-semibold`}>{t("home.deadlineCalendarTitle")}</Text>
              <Text className={`${secondaryTextClass} text-sm mt-1`}>
                {t("home.deadlineCalendarBody")}
              </Text>
            </View>
          </View>

          {desktopNextDeadlineEntry ? (
            renderNextDeadlineCard(desktopNextDeadlineEntry)
          ) : (
            <View className={`border rounded-3xl p-4 ${dashboardMutedClass}`}>
              <Text className={`${textClass} font-semibold`}>No deadlines yet</Text>
              <Text className={`${secondaryTextClass} text-sm mt-1`}>
                Add dates to your planner or finish your profile to see more deadlines here.
              </Text>
            </View>
          )}

          <AnimatedChipPressable
            onPress={openCalendar}
            className="mt-4 rounded-xl bg-emerald-500 px-4 py-3 items-center"
          >
            <Text className="text-white font-semibold">Open deadline calendar</Text>
          </AnimatedChipPressable>
        </View>

        {renderCurrentCoursesDashboardPanel()}

        {renderRecommendedNextDashboardPanel()}

        {renderDeadlinePanel(desktopCombinedDeadlineEntries)}
      </View>
    </>
  ) : null;

  const mobileDashboard = !isDesktopHome ? (
    <View className="gap-4">
      {renderMobileSnapshotPanel()}
      {renderCurrentCoursesDashboardPanel({ fullWidth: true })}
      {renderRecommendedNextDashboardPanel({ fullWidth: true })}
      {renderDeadlinePanel(desktopCombinedDeadlineEntries.slice(0, 3))}
    </View>
  ) : null;

  return (
    <ScreenBackground>
      <ScrollView className="flex-1" contentContainerStyle={scrollContentPadding}>
        <View
          className="w-full self-center pt-10"
          style={{
            maxWidth: contentMaxWidth,
            paddingHorizontal: desktopHorizontalPadding,
          }}
        >
          <View className="mb-6" style={isDesktopHome ? { maxWidth: 720 } : undefined}>
            <Text className={`text-2xl ${textClass} mb-1`}>
              {t("home.welcomeBack").replace("{name}", capitalizedName)}
            </Text>
            <Text className={secondaryTextClass}>{t("home.trackApplicationJourney")}</Text>
          </View>

          {isDesktopHome ? (
            <>
              {desktopDashboard}
            </>
          ) : (
            mobileDashboard
          )}
        </View>
      </ScrollView>
      {shouldShowTour && activeTourStep ? (
        <View className="absolute inset-0">
          <View className="absolute inset-0 bg-black/45" />
          <View
            style={{
              pointerEvents: "none",
              position: "absolute",
              left: activeTourStep.x - 24,
              top: activeTourStep.y - 24,
              width: 48,
              height: 48,
              borderRadius: 24,
              borderWidth: 2,
              borderColor: "#34d399",
              backgroundColor: "rgba(16,185,129,0.2)",
            }}
          />
          <View
            style={{
              position: "absolute",
              left: bubbleLeft,
              top: bubbleTop,
              width: bubbleWidth,
              minHeight: bubbleHeight,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: "#34d399",
              backgroundColor: isDark ? "#042f2e" : "#ecfdf5",
              paddingHorizontal: 14,
              paddingVertical: 12,
            }}
          >
            <Text className={`${textClass} font-semibold mb-1`}>{activeTourStep.title}</Text>
            <Text className={`${secondaryTextClass} text-sm`}>{activeTourStep.description}</Text>
            <Text className={`${secondaryTextClass} text-xs mt-2`}>
              {tourStepIndex + 1} of {tourSteps.length}
            </Text>
            <View className="flex-row justify-between mt-4">
              <AnimatedChipPressable onPress={completeTour} className="px-3 py-2 rounded-lg bg-black/25">
                <Text className="text-white font-semibold">Exit tutorial</Text>
              </AnimatedChipPressable>
              <AnimatedChipPressable onPress={advanceTour} className="px-3 py-2 rounded-lg bg-emerald-500">
                <Text className={`${isDark ? "text-white" : "text-emerald-900"} font-semibold`}>
                  {tourStepIndex === tourSteps.length - 1 ? "Finish" : "Next"}
                </Text>
              </AnimatedChipPressable>
            </View>
            <View
              style={{
                pointerEvents: "none",
                position: "absolute",
                width: 16,
                height: 16,
                backgroundColor: isDark ? "#042f2e" : "#ecfdf5",
                borderLeftWidth: 1,
                borderTopWidth: 1,
                borderColor: "#34d399",
                transform: [{ rotate: "45deg" }],
                left: pointerOffset,
                top: preferBubbleTop ? bubbleHeight - 8 : -8,
              }}
            />
          </View>
        </View>
      ) : null}
    </ScreenBackground>
  );
}

