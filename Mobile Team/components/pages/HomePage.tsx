import { useState, useEffect, useMemo, useCallback } from "react";
import { View, Text, Pressable, ScrollView, useWindowDimensions, Linking, Image, type DimensionValue } from "react-native";
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
import { OpportunityCarouselWheel } from "@/components/ui/OpportunityCarouselWheel";
import { HomeTaskMarquee, type HomeTaskMarqueeItem } from "@/components/ui/HomeTaskMarquee";
import { deadlineCalendarService, errorLoggingService, roadmapService } from "@/services";
import type { DeadlineCalendarEntry, RoadmapTask, UserRoadmapDocument } from "@/services";
import type { MatchedOpportunity } from "@/services/opportunities/opportunity-matching.service";
type HomeImportantMessage = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  actionLabel: string;
  onPress: () => void;
  tone: "success" | "warning" | "info";
};

type HomeTourStep = {
  id: string;
  title: string;
  description: string;
  x: number;
  y: number;
};

type DesktopHomeTask = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  actionLabel: string;
  onPress: () => void;
  tone: "success" | "warning" | "info";
};

type RoadmapTaskWithSection = RoadmapTask & {
  sectionId: string;
  sectionTitle: string;
  sectionOrder: number;
};

const TRANSFER_PLANNER_CURRENT_COURSES_FIELD = "transferPlannerCurrentCoursesByPath";

const DESKTOP_HOME_MIN_WIDTH = 960;
const PHONE_FALLBACK_ASPECT_RATIO = 1.5;

function formatOpportunityDueLabel(value: string | null) {
  if (!value) return "Rolling";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Rolling";
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
    }).format(parsed);
  } catch {
    return parsed.toDateString();
  }
}

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

function getUpcomingDeadlineEntries(entries: DeadlineCalendarEntry[], limit = 3) {
  const pending = entries.filter((entry) => !entry.isDone);
  const now = Date.now();
  const upcoming = pending.filter((entry) => {
    const parsed = new Date(entry.dueAt);
    return !Number.isNaN(parsed.getTime()) && parsed.getTime() >= now;
  });

  return (upcoming.length ? upcoming : pending).slice(0, limit);
}

export default function HomePage() {
  const router = useRouter();
  const { isDark, isGreen, isLight } = useAppTheme();
  const { t } = useAppLanguage();
  const { isHydrated, state, setOnboardingSeen } = useAppData();
  const { matchedOpportunities } = useOpportunities();
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
  const featuredOpportunities = useMemo(
    () => unfinishedRecommendedOpportunities.slice(0, 3),
    [unfinishedRecommendedOpportunities]
  );
  const wheelOpportunities = useMemo(() => {
    const curated = unfinishedRecommendedOpportunities.filter(
      (opportunity) => opportunity.type !== "college_deadline"
    );
    const source = curated.length >= 3 ? curated : unfinishedRecommendedOpportunities;
    return source.slice(0, 7);
  }, [unfinishedRecommendedOpportunities]);
  const nextUpcomingOpportunity = useMemo(
    () =>
      [...unfinishedRecommendedOpportunities]
        .filter((opportunity) => !!opportunity.computedDueAt)
        .sort((left, right) =>
          (left.computedDueAt ?? "9999-12-31T00:00:00.000Z").localeCompare(
            right.computedDueAt ?? "9999-12-31T00:00:00.000Z"
          )
        )[0] ?? null,
    [unfinishedRecommendedOpportunities]
  );
  const [desktopRoadmap, setDesktopRoadmap] = useState<UserRoadmapDocument | null>(null);

  const [dismissedGuestPrompt, setDismissedGuestPrompt] = useState(false);
  const showExtraInfoPrompt = true;
  const [tourStepIndex, setTourStepIndex] = useState(0);

  const capitalizedName = user?.name 
    ? user.name.split(' ')[0].charAt(0).toUpperCase() + user.name.split(' ')[0].slice(1).toLowerCase()
    : t("home.student");

  const hasCompletedQuestionnaire = !!(state.questionnaireAnswers && Object.keys(state.questionnaireAnswers).length > 0);
  const openCalendar = useCallback(() => {
    router.push(
      {
        pathname: ROUTES.calendar,
        params: { returnTo: ROUTES.root },
      } as never
    );
  }, [router]);
  const openCollegeSearchTool = useCallback(() => {
    router.push(
      {
        pathname: ROUTES.collegeSearch,
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
          ...(user?.resume ? { resume: { fileUrl: user.resume } } : {}),
          ...(user?.transcript ? { transcripts: { fileUrl: user.transcript } } : {}),
        },
      }),
    [state.questionnaireAnswers, state.savedColleges, user?.gpa, user?.major, user?.resume, user?.transcript]
  );

  const textClass = isDark ? "text-white" : isGreen ? "text-white" : isLight ? "text-emerald-900" : "text-gray-900";
  const secondaryTextClass = isDark ? "text-gray-400" : isGreen ? "text-emerald-100" : isLight ? "text-emerald-700" : "text-gray-600";
  const cardClass = isDark
    ? "bg-gray-900/80 border-gray-800"
    : isGreen
      ? "bg-emerald-900/90 border-emerald-800"
      : isLight
        ? "bg-white border-emerald-200"
        : "bg-white/90 border-gray-200";
  const placeholderTextColor = isDark ? "#9CA3AF" : isGreen ? "#b6e2b6" : isLight ? "#1f8a5d" : "#6B7280";
  const guestCtaCardClass = isLight ? "bg-emerald-100 border border-emerald-200" : isDark ? "bg-emerald-500 border" : "bg-emerald-500";
  const guestCtaCardStyle = isDark ? { backgroundColor: "#00572b", borderColor: "#00753e" } : undefined;
  const guestCtaIconBgClass = isLight ? "bg-emerald-500/10 border border-emerald-200" : isDark ? "bg-white/10 border border-white/10" : "bg-emerald-900/10";
  const guestCtaIconColor = isLight ? "#1f8a5d" : isDark ? "#8cd19e" : "#001f0f";
  const guestCtaTitleClass = isLight ? "text-emerald-900" : "text-white";
  const guestCtaBodyClass = isLight ? "text-emerald-800" : "text-emerald-100";
  const guestCtaPrimaryButtonClass = isLight ? "bg-emerald-500" : "bg-emerald-900";
  const guestCtaPrimaryTextClass = "text-white";
  const guestCtaSecondaryButtonClass = isLight ? "bg-white/90 border border-emerald-200" : "bg-emerald-900/20";
  const guestCtaSecondaryTextClass = isLight ? "text-emerald-700" : "text-white";
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
  const desktopSideColumnWidth = Math.min(380, Math.max(320, screenWidth * 0.31));
  const desktopHeaderShouldStack = isDesktopHome && (screenWidth < 1240 || effectiveFontScale > 1.15);
  const desktopActionCardsShouldStack = isDesktopHome && (screenWidth < 1280 || effectiveFontScale > 1.15);
  const mobileOpportunityHeaderShouldStack =
    !isDesktopHome && (screenWidth < 420 || effectiveFontScale > 1.05);
  const dashboardSectionWidth = desktopColumnsShouldStack
    ? { width: "100%" as DimensionValue }
    : { width: "48.8%" as DimensionValue };
  const renderGuestAccountCta = ({ desktop }: { desktop: boolean }) => (
    <View style={desktop ? { flex: 1, justifyContent: "space-between" } : undefined}>
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
        <Pressable
          onPress={() => router.push(ROUTES.login)}
          className={`flex-1 ${guestCtaPrimaryButtonClass} rounded-lg py-2 items-center justify-center`}
        >
          <Text className={`${guestCtaPrimaryTextClass} font-semibold text-sm`}>{t("home.signUp")}</Text>
        </Pressable>

        {!desktop ? (
          <Pressable
            onPress={() => setDismissedGuestPrompt(true)}
            className={`flex-1 ${guestCtaSecondaryButtonClass} rounded-lg py-2 items-center justify-center`}
          >
            <Text className={`${guestCtaSecondaryTextClass} font-semibold text-sm`}>{t("home.later")}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
  const openOpportunity = useCallback(async (opportunity: MatchedOpportunity) => {
    try {
      if (opportunity.type === "college_deadline" && opportunity.college.collegeId) {
        router.push(ROUTES.collegeDetail(String(opportunity.college.collegeId)));
        return;
      }

      if (opportunity.externalUrl) {
        await Linking.openURL(opportunity.externalUrl);
        return;
      }
    } catch (error) {
      void errorLoggingService.captureException(error, {
        category: "app",
        operation: "open-home-opportunity",
        severity: "warn",
        handled: true,
        source: "HomePage",
        screen: "HomePage",
        route: "/",
        metadata: {
          opportunityId: opportunity.opportunityId,
          opportunityType: opportunity.type,
        },
      });
    }

    router.push(ROUTES.tabsResources);
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    if (!isDesktopHome || !isHydrated || !user?.uid) {
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

  const desktopPendingRoadmapTasks = useMemo<RoadmapTaskWithSection[]>(() => {
    if (!desktopRoadmap) return [];

    return Object.values(desktopRoadmap.sections)
      .flatMap((section) =>
        section.tasks.map((task) => ({
          ...task,
          sectionId: section.id,
          sectionTitle: section.title,
          sectionOrder: section.order,
        }))
      )
      .filter((task) => task.status !== "completed")
      .sort((left, right) => {
        if (left.sectionOrder !== right.sectionOrder) {
          return left.sectionOrder - right.sectionOrder;
        }
        return left.order - right.order;
      });
  }, [desktopRoadmap]);

  const desktopNextRoadmapTask = useMemo(
    () => desktopPendingRoadmapTasks.find((task) => task.id !== "documents-checklist") ?? null,
    [desktopPendingRoadmapTasks]
  );
  const desktopCurrentCourses = useMemo(
    () => desktopRoadmap?.profileSnapshot.currentCourses ?? [],
    [desktopRoadmap?.profileSnapshot.currentCourses]
  );
  const desktopRequiredCourses = useMemo(
    () => desktopRoadmap?.profileSnapshot.requiredCourses ?? [],
    [desktopRoadmap?.profileSnapshot.requiredCourses]
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
  const desktopPrimaryOpportunity = unfinishedRecommendedOpportunities[0] ?? null;
  const desktopProfileName = user?.name?.trim() || t("home.student");
  const desktopProfileMajor = user?.major?.trim() || desktopRoadmap?.profileSnapshot.major?.trim() || t("home.undecided");
  const desktopProfileGpa = user?.gpa?.trim() || desktopRoadmap?.profileSnapshot.gpa?.trim() || t("general.notSpecified");
  const desktopCombinedDeadlineEntries = useMemo(
    () =>
      getUpcomingDeadlineEntries(
        deadlineCalendarService.buildEntries({
          roadmap: desktopRoadmap,
          opportunities: unfinishedRecommendedOpportunities,
        }),
        5
      ),
    [desktopRoadmap, unfinishedRecommendedOpportunities]
  );
  const desktopNextDeadlineEntry = useMemo(
    () => desktopCombinedDeadlineEntries[0] ?? null,
    [desktopCombinedDeadlineEntries]
  );
  const getLocalizedOpportunityDueLabel = useCallback(
    (value: string | null) => {
      const label = formatOpportunityDueLabel(value);
      return label === "Rolling" ? t("home.rolling") : label;
    },
    [t]
  );
  const getOpportunityTypeLabel = useCallback(
    (opportunity: MatchedOpportunity) => {
      if (opportunity.type === "college_deadline") return t("home.opportunityTypeDeadline");
      if (opportunity.type === "scholarship") return t("home.opportunityTypeScholarship");
      return t("home.opportunityTypeInternship");
    },
    [t]
  );

  const handleOpenDeadlineEntry = useCallback(async (item: DeadlineCalendarEntry) => {
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
      router.push(item.target.type === "roadmap" ? ROUTES.roadmap : ROUTES.tabsResources);
    }
  }, [router]);

  const desktopHomeTasks = useMemo<DesktopHomeTask[]>(() => {
    const tasks: DesktopHomeTask[] = [];
    const hasBlockingSetupTasks = !user?.resume || !user?.transcript || !hasCompletedQuestionnaire;

    if (!user?.resume) {
      tasks.push({
        id: "resume",
        icon: "document-attach-outline",
        title: t("home.desktopTaskResumeTitle"),
        body: t("home.desktopTaskResumeBody"),
        actionLabel: t("home.desktopTaskResumeAction"),
        onPress: () => router.push(ROUTES.profile),
        tone: "warning",
      });
    }

    if (!user?.transcript) {
      tasks.push({
        id: "transcript",
        icon: "document-text-outline",
        title: t("home.desktopTaskTranscriptTitle"),
        body: t("home.desktopTaskTranscriptBody"),
        actionLabel: t("home.desktopTaskTranscriptAction"),
        onPress: () => router.push(ROUTES.profile),
        tone: "warning",
      });
    }

    if (!hasCompletedQuestionnaire) {
      tasks.push({
        id: "questionnaire",
        icon: "clipboard-outline",
        title: t("home.desktopTaskQuestionnaireTitle"),
        body: t("home.desktopTaskQuestionnaireBody"),
        actionLabel: t("home.desktopTaskQuestionnaireAction"),
        onPress: () => router.push(ROUTES.questionnaire),
        tone: "info",
      });
    }

    if (!hasBlockingSetupTasks && desktopPrimaryOpportunity) {
      tasks.push({
        id: `opportunity-${desktopPrimaryOpportunity.opportunityId}`,
        icon: desktopPrimaryOpportunity.type === "scholarship" ? "gift-outline" : "briefcase-outline",
        title: t("home.desktopTaskApplyNextTitle", { title: desktopPrimaryOpportunity.title }),
        body: t("home.desktopTaskApplyNextBody", {
          due: getLocalizedOpportunityDueLabel(desktopPrimaryOpportunity.computedDueAt),
        }),
        actionLabel: t("home.desktopTaskOpenOpportunity"),
        onPress: () => {
          void openOpportunity(desktopPrimaryOpportunity);
        },
        tone: "success",
      });
    }

    if (desktopNextRoadmapTask) {
      tasks.push({
        id: `roadmap-${desktopNextRoadmapTask.id}`,
        icon:
          desktopNextRoadmapTask.type === "course"
            ? "school-outline"
            : desktopNextRoadmapTask.type === "application"
              ? "checkmark-done-outline"
              : desktopNextRoadmapTask.type === "interest"
                ? "sparkles-outline"
                : "map-outline",
        title: desktopNextRoadmapTask.title,
        body:
          desktopNextRoadmapTask.description ||
          t("home.desktopTaskRoadmapNextBody", {
            section: desktopNextRoadmapTask.sectionTitle.toLowerCase(),
          }),
        actionLabel: t("home.desktopTaskOpenRoadmap"),
        onPress: () => router.push(ROUTES.roadmap),
        tone: "info",
      });
    }

    if (hasBlockingSetupTasks && desktopPrimaryOpportunity) {
      tasks.push({
        id: `opportunity-preview-${desktopPrimaryOpportunity.opportunityId}`,
        icon: desktopPrimaryOpportunity.type === "scholarship" ? "gift-outline" : "briefcase-outline",
        title: t("home.desktopTaskOpportunityWaitingTitle", {
          title: desktopPrimaryOpportunity.title,
        }),
        body: t("home.desktopTaskOpportunityWaitingBody", {
          type: getOpportunityTypeLabel(desktopPrimaryOpportunity),
        }),
        actionLabel: t("home.desktopTaskViewOpportunity"),
        onPress: () => {
          void openOpportunity(desktopPrimaryOpportunity);
        },
        tone: "success",
      });
    }

    if (tasks.length === 0) {
      tasks.push(
        {
          id: "resources-scholarships",
          icon: "school-outline",
          title: t("home.desktopTaskMoreScholarshipsTitle"),
          body: t("home.desktopTaskMoreScholarshipsBody"),
          actionLabel: t("home.desktopTaskBrowseScholarships"),
          onPress: () => router.push(ROUTES.tabsResources),
          tone: "success",
        },
        {
          id: "resources-internships",
          icon: "briefcase-outline",
          title: t("home.desktopTaskInternshipsTitle"),
          body: t("home.desktopTaskInternshipsBody"),
          actionLabel: t("home.desktopTaskOpenResources"),
          onPress: () => router.push(ROUTES.tabsResources),
          tone: "info",
        }
      );
    }

    return tasks.slice(0, 4);
  }, [
    desktopNextRoadmapTask,
    desktopPrimaryOpportunity,
    hasCompletedQuestionnaire,
    t,
    getLocalizedOpportunityDueLabel,
    getOpportunityTypeLabel,
    openOpportunity,
    router,
    user?.resume,
    user?.transcript,
  ]);

  const desktopMarqueeItems = useMemo<HomeTaskMarqueeItem[]>(() => {
    const items: HomeTaskMarqueeItem[] = [];
    const seen = new Set<string>();

    const pushItem = (item: HomeTaskMarqueeItem) => {
      if (seen.has(item.id)) return;
      seen.add(item.id);
      items.push(item);
    };

    for (const task of desktopHomeTasks) {
      pushItem({
        id: task.id,
        title: task.title,
        body: task.body,
        actionLabel: task.actionLabel,
        icon: task.icon,
        badge: null,
        onPress: task.onPress,
      });
    }

    for (const opportunity of unfinishedRecommendedOpportunities.slice(0, 5)) {
      pushItem({
        id: `marquee-${opportunity.opportunityId}`,
        title:
          opportunity.type === "college_deadline"
            ? t("home.desktopMarqueeReviewTitle", { title: opportunity.title })
            : t("home.desktopMarqueeApplyTitle", { title: opportunity.title }),
        body: opportunity.summary,
        actionLabel: opportunity.externalUrl
          ? t("home.desktopTaskOpenOpportunity")
          : t("home.desktopMarqueeViewDetails"),
        icon:
          opportunity.type === "scholarship"
            ? "gift-outline"
            : opportunity.type === "college_deadline"
              ? "school-outline"
              : "briefcase-outline",
        badge: opportunity.computedDueAt ? getLocalizedOpportunityDueLabel(opportunity.computedDueAt) : null,
        onPress: () => {
          void openOpportunity(opportunity);
        },
      });
    }

    if (!items.length) {
      pushItem({
        id: "marquee-resources",
        title: t("home.desktopMarqueeFindNextTitle"),
        body: t("home.desktopMarqueeFindNextBody"),
        actionLabel: t("home.desktopTaskOpenResources"),
        icon: "compass-outline",
        badge: null,
        onPress: () => router.push(ROUTES.tabsResources),
      });
    }

    return items.slice(0, 8);
  }, [desktopHomeTasks, getLocalizedOpportunityDueLabel, openOpportunity, router, t, unfinishedRecommendedOpportunities]);

  const importantMessages = useMemo<HomeImportantMessage[]>(() => {
    const messages: HomeImportantMessage[] = [];

    messages.push(
      state.notificationsEnabled
        ? {
            id: "notifications-on",
            icon: "notifications",
            title: "Notifications are on",
            body: "Opportunity and deadline reminders can keep nudging you on this device.",
            actionLabel: "Manage",
            onPress: () => router.push(ROUTES.tabsSettings),
            tone: "success",
          }
        : {
            id: "notifications-off",
            icon: "notifications-off",
            title: "Turn on notifications",
            body: "Enable reminders so scholarships and college deadlines do not slip by quietly.",
            actionLabel: "Open settings",
            onPress: () => router.push(ROUTES.tabsSettings),
            tone: "warning",
          }
    );

    if (desktopCoursePlanningDeadline) {
      messages.push({
        id: "class-planning-deadline",
        icon: "school-outline",
        title: "Class planning deadline",
        body: `Keep registration moving before ${formatImportantDate(desktopCoursePlanningDeadline, "your next planning window")}.`,
        actionLabel: "Open calendar",
        onPress: openCalendar,
        tone: "warning",
      });
    }

    if (nextUpcomingOpportunity) {
      messages.push({
        id: "next-opportunity",
        icon: "time-outline",
        title: "Next recommended due date",
        body: `${nextUpcomingOpportunity.title} is due ${formatOpportunityDueLabel(nextUpcomingOpportunity.computedDueAt)}.`,
        actionLabel: "Open",
        onPress: () => {
          void openOpportunity(nextUpcomingOpportunity);
        },
        tone: "info",
      });
    }

    messages.push({
      id: "calendar",
      icon: "calendar-outline",
      title: "Deadline calendar is live",
      body: "Track roadmap milestones, scholarships, and college deadlines from one view.",
      actionLabel: "Open calendar",
      onPress: openCalendar,
      tone: "info",
    });

    if (!hasCompletedQuestionnaire) {
      messages.push({
        id: "questionnaire",
        icon: "document-text-outline",
        title: "Complete your questionnaire",
        body: "More profile detail improves matching for colleges and opportunities.",
        actionLabel: "Start now",
        onPress: () => router.push(ROUTES.questionnaire),
        tone: "warning",
      });
    } else if (user?.isGuest) {
      messages.push({
        id: "guest-account",
        icon: "person-add-outline",
        title: "Save your progress",
        body: "Create an account to sync roadmap, opportunities, and notifications across sessions.",
        actionLabel: "Create account",
        onPress: () => router.push(ROUTES.login),
        tone: "info",
      });
    } else if ((state.savedColleges?.length ?? 0) === 0) {
      messages.push({
        id: "saved-colleges",
        icon: "bookmark-outline",
        title: "Save colleges for more deadlines",
        body: "Saved colleges help generate college-deadline opportunities and reminders.",
        actionLabel: "Search colleges",
        onPress: openCollegeSearchTool,
        tone: "info",
      });
    }

    return messages.slice(0, 4);
  }, [
    desktopCoursePlanningDeadline,
    hasCompletedQuestionnaire,
    openCollegeSearchTool,
    nextUpcomingOpportunity,
    router,
    state.notificationsEnabled,
    state.savedColleges,
    user?.isGuest,
    openCalendar,
    openOpportunity,
  ]);

  const shouldShowTour = Boolean(user && !user.isGuest && user.hasSeenOnboarding !== true);
  const tourCardWidth = Math.min(448, Math.max(280, screenWidth - 32));
  const tourCardLeft = (screenWidth - tourCardWidth) / 2;
  const topAnchor = insets.top + 40;
  const tabAnchorY = screenHeight - insets.bottom - 56;

  const tourSteps = useMemo<HomeTourStep[]>(() => [
    {
      id: "roadmap",
      title: "Roadmap",
      description: "Roadmap tracks tasks and transfer milestones so you always know your next step.",
      x: tourCardLeft + tourCardWidth * 0.5,
      y: topAnchor + 360,
    },
    {
      id: "tab-home",
      title: "Home",
      description: "Home is your main page for tasks, deadlines, and your roadmap snapshot.",
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
            <Pressable
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
                <View className={`px-3 py-1.5 rounded-full ${dashboardBadgeClass}`}>
                  <Text className={`${dashboardBadgeTextClass} text-xs font-semibold`}>
                    {formatImportantDate(entry.dueAt)}
                  </Text>
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      ) : (
        <View className={`border rounded-3xl p-4 ${dashboardMutedClass}`}>
          <Text className={`${textClass} font-semibold`}>No deadlines yet</Text>
          <Text className={`${secondaryTextClass} text-sm mt-1`}>
            Add dates to your roadmap or finish your profile to see more deadlines here.
          </Text>
        </View>
      )}
    </View>
  );

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
            <Pressable
              onPress={() => {
                void handleOpenDeadlineEntry(desktopNextDeadlineEntry);
              }}
              className={`border rounded-3xl p-4 ${dashboardItemClass}`}
            >
              <View className="flex-row items-start">
                <View className="flex-1 min-w-0 pr-3">
                  <Text className={`${textClass} font-semibold`} numberOfLines={2}>
                    {desktopNextDeadlineEntry.title}
                  </Text>
                  <Text className={`${secondaryTextClass} text-sm mt-1`} numberOfLines={2}>
                    {desktopNextDeadlineEntry.subtitle}
                  </Text>
                  <Text className="text-emerald-500 text-xs font-semibold mt-3">
                    {t("home.openAction")}
                  </Text>
                </View>
                <View className={`px-3 py-1.5 rounded-full ${dashboardBadgeClass}`}>
                  <Text className={`${dashboardBadgeTextClass} text-xs font-semibold`}>
                    {formatImportantDate(desktopNextDeadlineEntry.dueAt)}
                  </Text>
                </View>
              </View>
            </Pressable>
          ) : (
            <View className={`border rounded-3xl p-4 ${dashboardMutedClass}`}>
              <Text className={`${textClass} font-semibold`}>No deadlines yet</Text>
              <Text className={`${secondaryTextClass} text-sm mt-1`}>
                Add dates to your roadmap or finish your profile to see more deadlines here.
              </Text>
            </View>
          )}

          <Pressable
            onPress={openCalendar}
            className="mt-4 rounded-xl bg-emerald-500 px-4 py-3 items-center"
          >
            <Text className="text-white font-semibold">Open deadline calendar</Text>
          </Pressable>
        </View>

        {renderDeadlinePanel(desktopCombinedDeadlineEntries)}
      </View>

      <View className="mt-6">
        <HomeTaskMarquee items={desktopMarqueeItems} />
      </View>
    </>
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
            <>
              <View
                style={
                  isDesktopHome
                    ? {
                        flexDirection: "row",
                        alignItems: "flex-start",
                        gap: 24,
                        flexWrap: desktopColumnsShouldStack ? "wrap" : "nowrap",
                      }
                    : undefined
                }
              >
            <View
              style={
                isDesktopHome
                  ? desktopColumnsShouldStack
                    ? { width: "100%", minWidth: 0 }
                    : { flex: 1, minWidth: 0 }
                  : undefined
              }
            >
              {user ? (
                <View className={`${cardClass} border rounded-2xl p-4 mb-4`}>
                  <View className="flex-row items-center">
                    <View className="w-12 h-12 rounded-full bg-emerald-500/20 items-center justify-center mr-3">
                      <Ionicons name="person" size={22} color="#008f4e" />
                    </View>
                    <View className="flex-1">
                      <Text className={`${textClass} font-semibold`} numberOfLines={1}>
                        {user.name || t("home.student")}
                      </Text>
                      <Text className={`${secondaryTextClass} text-sm`} numberOfLines={1}>
                        {user.major?.trim() || desktopRoadmap?.profileSnapshot.major?.trim() || t("home.undecided")}
                      </Text>
                    </View>
                  </View>
                </View>
              ) : null}

              {user?.isGuest && !dismissedGuestPrompt && !isDesktopHome && (
                <View className={`mb-6 rounded-2xl p-4 ${guestCtaCardClass}`} style={guestCtaCardStyle}>
                  {renderGuestAccountCta({ desktop: false })}
                </View>
              )}

              {isDesktopHome ? (
                <View className={`${cardClass} border rounded-2xl p-5 mb-4`}>
                  <View className="flex-row items-center justify-between mb-4">
                    <View className="flex-row items-center">
                      <View className="mr-3 p-2 rounded-xl bg-emerald-500/15">
                        <Ionicons name="list-outline" size={18} color="#008f4e" />
                      </View>
                      <View>
                        <Text className={`${textClass} font-semibold text-base`}>
                          {t("home.yourNextSteps")}
                        </Text>
                        <Text className={`${secondaryTextClass} text-sm`}>
                          {t("home.yourNextStepsDescription")}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View className="gap-3">
                    {desktopHomeTasks.map((task) => {
                      const toneClass =
                        task.tone === "success"
                          ? isDark
                            ? "bg-emerald-950/60 border-emerald-800"
                            : "bg-emerald-50 border-emerald-200"
                          : task.tone === "warning"
                            ? isDark
                              ? "bg-amber-950/60 border-amber-800"
                              : "bg-amber-50 border-amber-200"
                            : isDark
                              ? "bg-sky-950/40 border-sky-900"
                              : "bg-sky-50 border-sky-200";
                      const toneTextClass =
                        task.tone === "warning"
                          ? isDark
                            ? "text-amber-200"
                            : "text-amber-800"
                          : task.tone === "success"
                            ? isDark
                              ? "text-emerald-100"
                              : "text-emerald-800"
                            : isDark
                              ? "text-sky-100"
                              : "text-sky-800";

                      return (
                        <Pressable
                          key={task.id}
                          onPress={task.onPress}
                          className={`border rounded-2xl p-4 ${toneClass}`}
                        >
                          <View className="flex-row items-start">
                            <View className="w-10 h-10 rounded-xl bg-white/10 items-center justify-center mr-3">
                              <Ionicons name={task.icon} size={18} color="#008f4e" />
                            </View>
                            <View className="flex-1">
                              <Text className={`${textClass} font-semibold`}>
                                {task.title}
                              </Text>
                              <Text className={`${secondaryTextClass} text-sm mt-1`}>
                                {task.body}
                              </Text>
                              <Text className={`${toneTextClass} text-xs font-semibold mt-3`}>
                                {task.actionLabel}
                              </Text>
                            </View>
                            <Ionicons
                              name="chevron-forward"
                              size={18}
                              color={placeholderTextColor}
                            />
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {!isDesktopHome ? (
                <>
              {!hasCompletedQuestionnaire && (
                <Pressable
                  onPress={() => router.push(ROUTES.questionnaire)}
                  className="w-full rounded-2xl p-4 flex-row items-center bg-emerald-500 mb-4"
                >
                  <View className="mr-3 p-2 rounded-xl bg-emerald-900/10">
                    <Ionicons name="document-text" size={18} color="#000" />
                  </View>
                  <View className="flex-1">
                    <Text className={`font-semibold ${isDark ? 'text-white' : 'text-emerald-900'}`}>{t("home.completeQuestionnaire")}</Text>
                    <Text className="text-emerald-900/70 text-sm">{t("home.getPersonalizedRecommendations")}</Text>
                  </View>
                  <Ionicons name="sparkles" size={18} color="#000" />
                </Pressable>
              )}

              <Pressable
                onPress={() => router.push(ROUTES.roadmap)}
                className={`w-full rounded-2xl p-4 flex-row items-center ${cardClass} border`}
              >
                <View className="mr-3 p-2 rounded-xl bg-emerald-500/20">
                  <Ionicons name="map" size={18} color="#008f4e" />
                </View>
                <View className="flex-1">
                  <Text className={`font-semibold ${textClass}`}>{t("home.viewRoadmap")}</Text>
                  <Text className={`${secondaryTextClass} text-sm`}>{t("home.trackApplicationJourney")}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={placeholderTextColor} />
              </Pressable>

              <Pressable
                onPress={openCalendar}
                className={`w-full rounded-2xl p-4 flex-row items-center ${cardClass} border mt-4`}
              >
                <View className="mr-3 p-2 rounded-xl bg-emerald-500/20">
                  <Ionicons name="calendar-outline" size={18} color="#008f4e" />
                </View>
                <View className="flex-1">
                  <Text className={`font-semibold ${textClass}`}>{t("home.deadlineCalendarTitle")}</Text>
                  <Text className={`${secondaryTextClass} text-sm`}>
                    {t("home.deadlineCalendarBody")}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={placeholderTextColor} />
              </Pressable>

              {!isDesktopHome && featuredOpportunities.length ? (
                <View className={`${cardClass} border rounded-2xl p-4 mt-4`}>
                  <View
                    className="mb-3"
                    style={
                      mobileOpportunityHeaderShouldStack
                        ? { gap: 12 }
                        : {
                            flexDirection: "row",
                            alignItems: "flex-start",
                            justifyContent: "space-between",
                            gap: 12,
                          }
                    }
                  >
                    <View className="flex-row items-center" style={{ flex: 1, minWidth: 0 }}>
                      <View className="mr-3 p-2 rounded-xl bg-emerald-500/20">
                        <Ionicons name="gift-outline" size={18} color="#008f4e" />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text className={`font-semibold ${textClass}`}>GRC Opportunities</Text>
                        <Text className={`${secondaryTextClass} text-sm`} numberOfLines={2}>
                          Starter scholarships and opportunities now feeding reminders
                        </Text>
                      </View>
                    </View>

                    <Pressable
                      onPress={() => router.push(ROUTES.tabsResources)}
                      style={
                        mobileOpportunityHeaderShouldStack
                          ? { alignSelf: "flex-start" }
                          : { flexShrink: 0, alignSelf: "flex-start" }
                      }
                    >
                      <Text className="text-emerald-500 text-sm font-medium">View all</Text>
                    </Pressable>
                  </View>

                  <View className="gap-3">
                    {featuredOpportunities.map((opportunity) => (
                      <Pressable
                        key={opportunity.opportunityId}
                        onPress={() => {
                          void openOpportunity(opportunity);
                        }}
                        className={`rounded-xl border ${isDark ? "border-gray-800 bg-gray-950/50" : isGreen ? "border-emerald-700 bg-emerald-950/20" : isLight ? "border-emerald-200 bg-emerald-50" : "border-gray-200 bg-gray-50"} p-3`}
                      >
                        <View className="flex-row items-start justify-between">
                          <View className="flex-1 pr-3">
                            <Text className={`${textClass} font-medium`} numberOfLines={1}>
                              {opportunity.title}
                            </Text>
                            <Text className={`${secondaryTextClass} text-sm mt-1`} numberOfLines={2}>
                              {opportunity.summary}
                            </Text>
                          </View>

                          <View className="items-end">
                            <Text className="text-emerald-500 text-xs font-semibold">
                              {getLocalizedOpportunityDueLabel(opportunity.computedDueAt)}
                            </Text>
                            {opportunity.type === "scholarship" ? (
                              <Text className={`${secondaryTextClass} text-xs mt-1`}>{t("home.opportunityTypeScholarship")}</Text>
                            ) : opportunity.type === "internship" ? (
                              <Text className={`${secondaryTextClass} text-xs mt-1`}>{t("home.opportunityTypeInternship")}</Text>
                            ) : (
                              <Text className={`${secondaryTextClass} text-xs mt-1`}>{t("home.opportunityTypeDeadline")}</Text>
                            )}
                          </View>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}

              {!isDesktopHome && showExtraInfoPrompt ? (
                <View className={`${cardClass} border rounded-2xl p-4 mt-4`}>
                  <View className="flex-row items-start">
                    <View className="mt-0.5 mr-3">
                      <Ionicons name="chatbubble-ellipses" size={18} color={placeholderTextColor} />
                    </View>

                    <View className="flex-1">
                      <Text className={`${textClass} font-medium mb-1`}>{t("home.anythingElse")}</Text>
                      <Text className={`${secondaryTextClass} text-sm`}>
                        {t("home.anythingElseDescription")}
                      </Text>
                    </View>
                  </View>
                </View>
              ) : null}
                </>
              ) : null}
            </View>

            {isDesktopHome ? (
              <View
                style={
                  desktopColumnsShouldStack
                    ? { width: "100%" }
                    : { width: desktopSideColumnWidth, flexShrink: 0 }
                }
              >
                <View className={`${cardClass} border rounded-2xl p-5`}>
                  <View
                    className="mb-4"
                    style={
                      desktopHeaderShouldStack
                        ? { gap: 12 }
                        : {
                            flexDirection: "row",
                            alignItems: "flex-start",
                            justifyContent: "space-between",
                            gap: 12,
                          }
                    }
                  >
                    <View className="flex-row items-start" style={{ flex: 1, minWidth: 0 }}>
                      <View className="mr-3 p-2 rounded-xl bg-emerald-500/15">
                        <Ionicons name="notifications-outline" size={18} color="#008f4e" />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text className={`${textClass} font-semibold text-base`}>
                          Notifications & Important Messages
                        </Text>
                        <Text className={`${secondaryTextClass} text-sm`}>
                          Registration, deadlines, and reminders that need your attention
                        </Text>
                      </View>
                    </View>

                    <Pressable
                      onPress={() => router.push(ROUTES.tabsSettings)}
                      style={desktopHeaderShouldStack ? { alignSelf: "flex-start" } : undefined}
                    >
                      <Text className="text-emerald-500 text-sm font-medium">Manage</Text>
                    </Pressable>
                  </View>

                  <View className="gap-3">
                    {importantMessages.map((message) => {
                      const toneClass =
                        message.tone === "success"
                          ? isDark
                            ? "bg-emerald-950/60 border-emerald-800"
                            : "bg-emerald-50 border-emerald-200"
                          : message.tone === "warning"
                            ? isDark
                              ? "bg-amber-950/60 border-amber-800"
                              : "bg-amber-50 border-amber-200"
                            : isDark
                              ? "bg-sky-950/40 border-sky-900"
                              : "bg-sky-50 border-sky-200";
                      const toneTextClass =
                        message.tone === "warning"
                          ? isDark
                            ? "text-amber-200"
                            : "text-amber-800"
                          : message.tone === "success"
                            ? isDark
                              ? "text-emerald-100"
                              : "text-emerald-800"
                            : isDark
                              ? "text-sky-100"
                              : "text-sky-800";

                      return (
                        <Pressable
                          key={message.id}
                          onPress={message.onPress}
                          className={`border rounded-2xl p-4 ${toneClass}`}
                        >
                          <View className="flex-row items-start">
                            <View className="w-10 h-10 rounded-xl bg-white/10 items-center justify-center mr-3">
                              <Ionicons name={message.icon} size={18} color="#008f4e" />
                            </View>
                            <View className="flex-1">
                              <Text className={`${textClass} font-semibold`}>
                                {message.title}
                              </Text>
                              <Text className={`${secondaryTextClass} text-sm mt-1`}>
                                {message.body}
                              </Text>
                              <Text className={`${toneTextClass} text-xs font-semibold mt-3`}>
                                {message.actionLabel}
                              </Text>
                            </View>
                            <Ionicons
                              name="chevron-forward"
                              size={18}
                              color={placeholderTextColor}
                            />
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View className={`${cardClass} border rounded-2xl p-5 mt-4`}>
                  <View
                    className="mb-4"
                    style={
                      desktopHeaderShouldStack
                        ? { gap: 12 }
                        : {
                            flexDirection: "row",
                            alignItems: "flex-start",
                            justifyContent: "space-between",
                            gap: 12,
                          }
                    }
                  >
                    <View className="flex-row items-start" style={{ flex: 1, minWidth: 0 }}>
                      <View className="mr-3 p-2 rounded-xl bg-emerald-500/15">
                        <Ionicons name="school-outline" size={18} color="#008f4e" />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text className={`${textClass} font-semibold text-base`}>
                          Current courses
                        </Text>
                        <Text className={`${secondaryTextClass} text-sm`}>
                          Shared from your roadmap and questionnaire data
                        </Text>
                      </View>
                    </View>

                    <Pressable
                      onPress={() => router.push(ROUTES.roadmap)}
                      style={desktopHeaderShouldStack ? { alignSelf: "flex-start" } : undefined}
                    >
                      <Text className="text-emerald-500 text-sm font-medium">Roadmap</Text>
                    </Pressable>
                  </View>

                  {user?.uid && !desktopRoadmap ? (
                    <View className={`border rounded-2xl p-4 ${isDark ? "border-gray-800 bg-gray-950/50" : isLight ? "border-emerald-200 bg-emerald-50" : "border-gray-200 bg-gray-50"}`}>
                      <Text className={`${textClass} font-medium mb-1`}>
                        Loading course plan...
                      </Text>
                      <Text className={`${secondaryTextClass} text-sm`}>
                        Pulling your latest roadmap snapshot so desktop and mobile stay in sync.
                      </Text>
                    </View>
                  ) : (
                    <View className="gap-4">
                      {desktopCoursePlanningDeadline ? (
                        <View className={`border rounded-2xl p-4 ${isDark ? "border-amber-800 bg-amber-950/40" : "border-amber-200 bg-amber-50"}`}>
                          <Text className={`${textClass} font-semibold`}>
                            Next class planning target
                          </Text>
                          <Text className={`${secondaryTextClass} text-sm mt-1`}>
                            Aim to get class sign-up ready by {formatImportantDate(desktopCoursePlanningDeadline)}.
                          </Text>
                        </View>
                      ) : null}

                      <View>
                        <Text className={`${textClass} font-semibold mb-2`}>
                          Enrolled or planned now
                        </Text>
                        {linkedCurrentCourses.length ? (
                          <View className="gap-2">
                            {linkedCurrentCourses.slice(0, 5).map((course) => (
                              <View
                                key={course}
                                className={`border rounded-2xl px-3 py-3 ${isDark ? "border-gray-800 bg-gray-950/50" : isLight ? "border-emerald-200 bg-emerald-50" : "border-gray-200 bg-gray-50"}`}
                              >
                                <Text className={textClass}>{course}</Text>
                              </View>
                            ))}
                          </View>
                        ) : (
                          <View className={`border rounded-2xl p-4 ${isDark ? "border-gray-800 bg-gray-950/50" : isLight ? "border-emerald-200 bg-emerald-50" : "border-gray-200 bg-gray-50"}`}>
                            <Text className={`${textClass} font-medium mb-1`}>
                              No current courses listed yet
                            </Text>
                            <Text className={`${secondaryTextClass} text-sm`}>
                              Add course planning details in your questionnaire or roadmap to keep this section filled in.
                            </Text>
                          </View>
                        )}
                      </View>

                      {desktopRequiredCourses.length ? (
                        <View>
                          <Text className={`${textClass} font-semibold mb-2`}>
                            Required course ideas
                          </Text>
                          <View className="flex-row flex-wrap gap-2">
                            {desktopRequiredCourses.slice(0, 6).map((course) => (
                              <View
                                key={course}
                                className={`rounded-full px-3 py-2 border ${isDark ? "border-emerald-800 bg-emerald-950/40" : "border-emerald-200 bg-emerald-50"}`}
                              >
                                <Text className={`${isDark ? "text-emerald-100" : "text-emerald-800"} text-sm`}>
                                  {course}
                                </Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      ) : null}

                      {desktopRecommendedCourses.length ? (
                        <View>
                          <Text className={`${textClass} font-semibold mb-2`}>
                            Recommended next
                          </Text>
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
                        </View>
                      ) : null}

                      <View
                        style={
                          desktopActionCardsShouldStack
                            ? { gap: 12 }
                            : { flexDirection: "row", gap: 12 }
                        }
                      >
                        <Pressable
                          onPress={() => router.push(ROUTES.roadmap)}
                          className="flex-1 rounded-xl bg-emerald-500 px-4 py-3 items-center"
                          style={desktopActionCardsShouldStack ? { width: "100%" } : undefined}
                        >
                          <Text className="text-white font-semibold">Open roadmap</Text>
                        </Pressable>
                        <Pressable
                          onPress={openCalendar}
                          className={`flex-1 rounded-xl px-4 py-3 items-center border ${isDark ? "border-gray-700 bg-gray-900" : isLight ? "border-emerald-200 bg-white" : "border-gray-200 bg-white"}`}
                          style={desktopActionCardsShouldStack ? { width: "100%" } : undefined}
                        >
                          <Text className={`${isDark ? "text-white" : "text-emerald-900"} font-semibold`}>
                            Open calendar
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            ) : null}
          </View>

          {isDesktopHome ? (
            <View className="mt-6">
              <View
                style={
                  desktopActionCardsShouldStack
                    ? { gap: 16 }
                    : { flexDirection: "row", gap: 16, flexWrap: "wrap" }
                }
              >
                {!hasCompletedQuestionnaire ? (
                  <Pressable
                    onPress={() => router.push(ROUTES.questionnaire)}
                    className="rounded-2xl p-4 flex-row items-center bg-emerald-500"
                    style={desktopActionCardsShouldStack ? { width: "100%" } : { flex: 1, minWidth: 220 }}
                  >
                    <View className="mr-3 p-2 rounded-xl bg-emerald-900/10">
                      <Ionicons name="document-text" size={18} color="#000" />
                    </View>
                    <View className="flex-1">
                      <Text className={`font-semibold ${isDark ? 'text-white' : 'text-emerald-900'}`}>{t("home.completeQuestionnaire")}</Text>
                      <Text className="text-emerald-900/70 text-sm">{t("home.getPersonalizedRecommendations")}</Text>
                    </View>
                    <Ionicons name="sparkles" size={18} color="#000" />
                  </Pressable>
                ) : null}

                <Pressable
                  onPress={() => router.push(ROUTES.roadmap)}
                  className={`rounded-2xl p-4 flex-row items-center ${cardClass} border`}
                  style={desktopActionCardsShouldStack ? { width: "100%" } : { flex: 1, minWidth: 220 }}
                >
                  <View className="mr-3 p-2 rounded-xl bg-emerald-500/20">
                    <Ionicons name="map" size={18} color="#008f4e" />
                  </View>
                  <View className="flex-1">
                    <Text className={`font-semibold ${textClass}`}>{t("home.viewRoadmap")}</Text>
                    <Text className={`${secondaryTextClass} text-sm`}>{t("home.trackApplicationJourney")}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={placeholderTextColor} />
                </Pressable>

                <Pressable
                  onPress={openCalendar}
                  className={`rounded-2xl p-4 flex-row items-center ${cardClass} border`}
                  style={desktopActionCardsShouldStack ? { width: "100%" } : { flex: 1, minWidth: 220 }}
                >
                  <View className="mr-3 p-2 rounded-xl bg-emerald-500/20">
                    <Ionicons name="calendar-outline" size={18} color="#008f4e" />
                  </View>
                  <View className="flex-1">
                    <Text className={`font-semibold ${textClass}`}>Deadline calendar</Text>
                    <Text className={`${secondaryTextClass} text-sm`}>
                      See scholarships, college deadlines, and roadmap dates by month
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={placeholderTextColor} />
                </Pressable>
              </View>

              {showExtraInfoPrompt ? (
                <View className={`${cardClass} border rounded-2xl p-4 mt-4`}>
                  <View className="flex-row items-start">
                    <View className="mt-0.5 mr-3">
                      <Ionicons name="chatbubble-ellipses" size={18} color={placeholderTextColor} />
                    </View>

                    <View className="flex-1">
                      <Text className={`${textClass} font-medium mb-1`}>{t("home.anythingElse")}</Text>
                      <Text className={`${secondaryTextClass} text-sm`}>
                        {t("home.anythingElseDescription")}
                      </Text>
                    </View>
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}
          {isDesktopHome && wheelOpportunities.length ? (
            <View className="mt-8">
              <OpportunityCarouselWheel
                opportunities={wheelOpportunities}
                onOpenOpportunity={(opportunity) => {
                  void openOpportunity(opportunity);
                }}
                onViewAll={() => router.push(ROUTES.tabsResources)}
              />
            </View>
          ) : null}
            </>
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
              <Pressable onPress={completeTour} className="px-3 py-2 rounded-lg bg-black/25">
                <Text className="text-white font-semibold">Exit tutorial</Text>
              </Pressable>
              <Pressable onPress={advanceTour} className="px-3 py-2 rounded-lg bg-emerald-500">
                <Text className={`${isDark ? "text-white" : "text-emerald-900"} font-semibold`}>
                  {tourStepIndex === tourSteps.length - 1 ? "Finish" : "Next"}
                </Text>
              </Pressable>
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

