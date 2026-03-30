import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

import { ScreenBackground } from "@/components/layouts/ScreenBackground";
import { StateCard } from "@/components/ui/StateCard";
import { StatusBanner } from "@/components/ui/StatusBanner";
import {
  getTransferPlannerMajorsForCampus,
  getTransferPlannerTrack,
  TRANSFER_PLANNER_CAMPUSES,
  TRANSFER_PLANNER_INVOLVEMENT_LINKS,
  type TransferPlannerCampusId,
  type TransferPlannerChecklistItem,
  type TransferPlannerCoverage,
} from "@/constants/transfer-planner-data";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useThemeStyles } from "@/hooks/use-theme-styles";

const STORAGE_KEY = "gatorguide:transfer-planner:progress:v1";

type ProgressMap = Record<string, boolean>;

function buildProgressKey(majorId: string, itemId: string) {
  return `${majorId}:${itemId}`;
}

function getCoverageBadgeClass(coverage: TransferPlannerCoverage) {
  return coverage === "detailed"
    ? "bg-emerald-500/10 border border-emerald-500/30"
    : "bg-amber-500/10 border border-amber-500/30";
}

function getCoverageTextClass(coverage: TransferPlannerCoverage) {
  return coverage === "detailed" ? "text-emerald-500" : "text-amber-500";
}

async function openExternalLink(url: string) {
  const safeUrl =
    url.startsWith("http://") || url.startsWith("https://") ? url : `https://${url}`;
  try {
    const canOpen = await Linking.canOpenURL(safeUrl);
    if (!canOpen) {
      Alert.alert("Link unavailable", "This link could not be opened on this device.");
      return;
    }
    await Linking.openURL(safeUrl);
  } catch {
    Alert.alert("Link unavailable", "This link could not be opened on this device.");
  }
}

function ChecklistSection({
  title,
  subtitle,
  items,
  majorId,
  progress,
  onToggle,
  textClass,
  secondaryTextClass,
  cardClass,
  borderClass,
}: {
  title: string;
  subtitle: string;
  items: TransferPlannerChecklistItem[];
  majorId: string;
  progress: ProgressMap;
  onToggle: (item: TransferPlannerChecklistItem) => void;
  textClass: string;
  secondaryTextClass: string;
  cardClass: string;
  borderClass: string;
}) {
  if (!items.length) return null;

  return (
    <View className={`${cardClass} border rounded-[28px] p-5`}>
      <Text className={`${textClass} text-lg font-semibold`}>{title}</Text>
      <Text className={`${secondaryTextClass} text-sm mt-1`}>{subtitle}</Text>

      <View className="gap-3 mt-4">
        {items.map((item) => {
          const isDone = !!progress[buildProgressKey(majorId, item.id)];
          return (
            <Pressable
              key={`${majorId}-${item.id}`}
              onPress={() => onToggle(item)}
              className={`${isDone ? "bg-emerald-500/8 border-emerald-500/25" : ""} border ${borderClass} rounded-2xl px-4 py-4 flex-row items-start`}
            >
              <View className="mt-0.5">
                <Ionicons
                  name={isDone ? "checkmark-circle" : "ellipse-outline"}
                  size={20}
                  color={isDone ? "#008f4e" : "#9CA3AF"}
                />
              </View>

              <View className="flex-1 ml-3">
                <Text className={`${textClass} font-semibold`}>{item.title}</Text>
                <Text className={`${secondaryTextClass} text-sm mt-1`}>
                  Best Green River options: {item.grcCourses.join(" • ")}
                </Text>
                {item.note ? (
                  <Text className={`${secondaryTextClass} text-xs mt-2`}>{item.note}</Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TransferPlannerPage() {
  const styles = useThemeStyles();
  const { width } = useWindowDimensions();
  const { getScrollContentPadding } = useResponsiveLayout();
  const [selectedCampusId, setSelectedCampusId] =
    useState<TransferPlannerCampusId>("uw-seattle");
  const [selectedMajorId, setSelectedMajorId] = useState<string>(
    getTransferPlannerMajorsForCampus("uw-seattle")[0]?.id ?? ""
  );
  const [progress, setProgress] = useState<ProgressMap>({});
  const [hydrated, setHydrated] = useState(false);

  const { textClass, secondaryTextClass, cardBgClass, inactiveButtonClass, borderClass } = styles;
  const isDesktop = width >= 1180;
  const isTablet = width >= 768;
  const shellMaxWidth = isDesktop ? 1280 : isTablet ? 980 : 760;
  const shellHorizontalPadding = width >= 1280 ? 32 : isTablet ? 24 : 20;
  const scrollContentPadding = getScrollContentPadding({
    includeTopInset: true,
    includeBottomTabClearance: true,
    extraTop: 16,
  });

  const campus = useMemo(
    () =>
      TRANSFER_PLANNER_CAMPUSES.find((entry) => entry.id === selectedCampusId) ??
      TRANSFER_PLANNER_CAMPUSES[0],
    [selectedCampusId]
  );
  const campusMajors = useMemo(
    () => getTransferPlannerMajorsForCampus(selectedCampusId),
    [selectedCampusId]
  );
  const plan = useMemo(
    () => campusMajors.find((entry) => entry.id === selectedMajorId) ?? campusMajors[0] ?? null,
    [campusMajors, selectedMajorId]
  );
  const track = useMemo(() => getTransferPlannerTrack(plan?.bestTrackId ?? null), [plan]);

  useEffect(() => {
    const nextFirstMajorId = campusMajors[0]?.id ?? "";
    if (!campusMajors.some((entry) => entry.id === selectedMajorId)) {
      setSelectedMajorId(nextFirstMajorId);
    }
  }, [campusMajors, selectedMajorId]);

  useEffect(() => {
    let mounted = true;

    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!mounted) return;
        if (!raw) {
          setHydrated(true);
          return;
        }

        try {
          const parsed = JSON.parse(raw) as ProgressMap;
          setProgress(parsed ?? {});
        } catch {
          setProgress({});
        } finally {
          setHydrated(true);
        }
      })
      .catch(() => {
        if (mounted) {
          setProgress({});
          setHydrated(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const toggleItem = useCallback(
    (item: TransferPlannerChecklistItem) => {
      if (!plan) return;

      setProgress((current) => {
        const key = buildProgressKey(plan.id, item.id);
        const next = {
          ...current,
          [key]: !current[key],
        };
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    [plan]
  );

  const resetMajorProgress = useCallback(() => {
    if (!plan) return;

    setProgress((current) => {
      const next = { ...current };
      Object.keys(next).forEach((key) => {
        if (key.startsWith(`${plan.id}:`)) {
          delete next[key];
        }
      });
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, [plan]);

  const uniqueChecklistItems = useMemo(() => {
    if (!plan) return [];

    const map = new Map<string, TransferPlannerChecklistItem>();
    [...plan.applicationChecklist, ...plan.beforeEnrollmentChecklist, ...plan.stayAtGrcChecklist].forEach(
      (item) => {
        map.set(item.id, item);
      }
    );
    return Array.from(map.values());
  }, [plan]);

  const visibleOfficialLinks = useMemo(() => {
    if (!plan) return [];

    const seen = new Set<string>();
    return [...plan.officialLinks, ...campus.officialLinks].filter((link) => {
      if (seen.has(link.url)) return false;
      seen.add(link.url);
      return true;
    });
  }, [campus.officialLinks, plan]);

  const completedCount = useMemo(() => {
    if (!plan) return 0;
    return uniqueChecklistItems.filter((item) => progress[buildProgressKey(plan.id, item.id)]).length;
  }, [plan, progress, uniqueChecklistItems]);

  if (!plan) {
    return (
      <ScreenBackground includeTopInset includeBottomInset={false}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <StateCard
            variant="empty"
            title="No planner data yet"
            message="There is not a transfer-planner entry for this campus yet."
          />
        </View>
      </ScreenBackground>
    );
  }

  const coverageBanner =
    plan.coverage === "detailed"
      ? {
          variant: "success" as const,
          title: "Detailed Seattle-style planning",
          message:
            "This path is backed by the Green River sample transfer plans, the UW Green River equivalency guide, and current department prerequisite pages. Still confirm deadlines and year-specific changes before final registration.",
        }
      : {
          variant: "warning" as const,
          title: "Planning start, not a final audit",
          message:
            "This path is useful for choosing the right Green River base track and opening the right official worksheets, but the final schedule should still be reviewed against the current campus program materials.",
        };

  return (
    <ScreenBackground includeTopInset includeBottomInset={false}>
      <ScrollView
        contentContainerStyle={{
          paddingBottom: scrollContentPadding.paddingBottom,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            alignSelf: "center",
            width: "100%",
            maxWidth: shellMaxWidth,
            paddingHorizontal: shellHorizontalPadding,
            paddingTop: scrollContentPadding.paddingTop + 12,
            gap: 24,
          }}
        >
          <View className="gap-4">
            <View className="flex-row items-start">
              <View className="w-12 h-12 rounded-2xl bg-emerald-500/10 items-center justify-center mr-3">
                <Ionicons name="trail-sign-outline" size={22} color="#008f4e" />
              </View>
              <View className="flex-1">
                <Text className={`${textClass} text-2xl font-semibold`}>
                  {"GRC -> UW Transfer Planner"}
                </Text>
                <Text className={`${secondaryTextClass} text-sm mt-1`}>
                  Engineering-first planning tool for Green River students. Pick a campus and major to see the strongest Green River track, the best UW prerequisite substitutes, and which extra classes are still worth finishing at Green River before transfer.
                </Text>
              </View>
            </View>

            <StatusBanner
              variant="info"
              title="How to use this"
              message="Start with the campus and major, then work top to bottom: apply checklist, before-enrollment checklist, and the classes still worth finishing at Green River because they are cheaper, easier, or cleaner to transfer. This v1 is strongest for UW Seattle engineering and computing paths."
            />
          </View>

          <View
            style={isDesktop ? { flexDirection: "row", alignItems: "flex-start", gap: 24 } : undefined}
          >
            <View style={isDesktop ? { width: 360, flexShrink: 0, gap: 16 } : { gap: 16 }}>
              <View className={`${cardBgClass} border rounded-[28px] p-5`}>
                <Text className={`${textClass} text-lg font-semibold`}>Campus</Text>
                <Text className={`${secondaryTextClass} text-sm mt-1`}>
                  Seattle is the most detailed. Bothell and Tacoma are intentionally marked as advisor-review planning starts.
                </Text>

                <View className="gap-3 mt-4">
                  {TRANSFER_PLANNER_CAMPUSES.map((entry) => {
                    const selected = entry.id === selectedCampusId;
                    return (
                      <Pressable
                        key={entry.id}
                        onPress={() => setSelectedCampusId(entry.id)}
                        className={`${selected ? "bg-emerald-500/10 border-emerald-500/30" : `${inactiveButtonClass} ${borderClass}`} border rounded-2xl px-4 py-4`}
                      >
                        <View className="flex-row items-start justify-between gap-3">
                          <View className="flex-1 min-w-0">
                            <Text className={`${textClass} font-semibold`}>{entry.title}</Text>
                            <Text className={`${secondaryTextClass} text-sm mt-1`}>
                              {entry.summary}
                            </Text>
                          </View>
                          <MaterialIcons
                            name={selected ? "radio-button-checked" : "radio-button-unchecked"}
                            size={20}
                            color={selected ? "#008f4e" : "#9CA3AF"}
                          />
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View className={`${cardBgClass} border rounded-[28px] p-5`}>
                <Text className={`${textClass} text-lg font-semibold`}>Major</Text>
                <Text className={`${secondaryTextClass} text-sm mt-1`}>
                  Pick the target program first. The planner then matches the best Green River base track and add-ons.
                </Text>

                <View className="gap-3 mt-4">
                  {campusMajors.map((entry) => {
                    const selected = entry.id === plan.id;
                    return (
                      <Pressable
                        key={entry.id}
                        onPress={() => setSelectedMajorId(entry.id)}
                        className={`${selected ? "bg-emerald-500/10 border-emerald-500/30" : `${inactiveButtonClass} ${borderClass}`} border rounded-2xl px-4 py-4`}
                      >
                        <View className="flex-row items-center justify-between gap-3">
                          <View className="flex-1 min-w-0">
                            <Text className={`${textClass} font-semibold`}>{entry.title}</Text>
                            <Text className={`${secondaryTextClass} text-sm mt-1`}>
                              {entry.summary}
                            </Text>
                          </View>
                          <View className={`${getCoverageBadgeClass(entry.coverage)} px-2.5 py-1 rounded-full`}>
                            <Text className={`${getCoverageTextClass(entry.coverage)} text-xs font-semibold`}>
                              {entry.coverage === "detailed" ? "Detailed" : "Review"}
                            </Text>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View className={`${cardBgClass} border rounded-[28px] p-5`}>
                <Text className={`${textClass} text-lg font-semibold`}>Progress</Text>
                <Text className={`${secondaryTextClass} text-sm mt-1`}>
                  Saved locally on this device so a student or advisor can track which requirements are already done.
                </Text>

                <View className="mt-4 flex-row items-center justify-between">
                  <View>
                    <Text className={`${textClass} text-2xl font-semibold`}>
                      {hydrated ? `${completedCount}/${uniqueChecklistItems.length}` : "--"}
                    </Text>
                    <Text className={`${secondaryTextClass} text-sm mt-1`}>
                      checklist items marked complete
                    </Text>
                  </View>

                  <View className={`${getCoverageBadgeClass(plan.coverage)} px-3 py-2 rounded-2xl`}>
                    <Text className={`${getCoverageTextClass(plan.coverage)} text-xs font-semibold`}>
                      {plan.coverage === "detailed" ? "Detailed v1" : "Advisor review"}
                    </Text>
                  </View>
                </View>

                <Pressable
                  onPress={resetMajorProgress}
                  className={`mt-4 px-4 py-3 rounded-2xl border ${borderClass} ${inactiveButtonClass}`}
                >
                  <Text className={`${textClass} text-sm font-medium text-center`}>
                    {"Reset this major's checklist"}
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={isDesktop ? { flex: 1, minWidth: 0, gap: 16 } : { gap: 16, marginTop: 16 }}>
              <View className={`${cardBgClass} border rounded-[28px] p-5`}>
                <View className="flex-row flex-wrap items-start gap-2 mb-4">
                  <View className={`${getCoverageBadgeClass(plan.coverage)} px-3 py-1.5 rounded-full`}>
                    <Text className={`${getCoverageTextClass(plan.coverage)} text-xs font-semibold`}>
                      {plan.coverage === "detailed" ? "Detailed v1 dataset" : "Advisor-review path"}
                    </Text>
                  </View>
                  <View className="px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30">
                    <Text className="text-emerald-500 text-xs font-semibold">{plan.startQuarter}</Text>
                  </View>
                </View>

                <Text className={`${textClass} text-2xl font-semibold`}>{plan.title}</Text>
                <Text className={`${secondaryTextClass} text-sm mt-2`}>{plan.summary}</Text>

                <View className="mt-4 gap-3">
                  <StatusBanner
                    variant={coverageBanner.variant}
                    title={coverageBanner.title}
                    message={coverageBanner.message}
                  />

                  <StatusBanner
                    variant="info"
                    title="Application timing"
                    message={plan.applicationWindow}
                  />
                </View>
              </View>

              <View className={`${cardBgClass} border rounded-[28px] p-5`}>
                <Text className={`${textClass} text-lg font-semibold`}>Best Green River path</Text>
                <Text className={`${secondaryTextClass} text-sm mt-1`}>
                  This section answers the most important advising question first: which Green River track should the student stay on?
                </Text>

                <View className={`mt-4 border ${borderClass} rounded-2xl px-4 py-4`}>
                  <Text className={`${textClass} font-semibold`}>
                    {track ? `${track.code} - ${track.title}` : "Custom advisor-reviewed path"}
                  </Text>
                  <Text className={`${secondaryTextClass} text-sm mt-2`}>
                    {plan.bestTrackSummary}
                  </Text>
                  <Text className={`${secondaryTextClass} text-sm mt-3`}>
                    {plan.financialAidNote}
                  </Text>
                </View>

                <View className="gap-2 mt-4">
                  {plan.whyThisTrack.map((line) => (
                    <View key={line} className="flex-row items-start">
                      <Ionicons name="checkmark-circle-outline" size={18} color="#008f4e" style={{ marginTop: 2 }} />
                      <Text className={`${secondaryTextClass} text-sm ml-2 flex-1`}>{line}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {track ? (
                <View className={`${cardBgClass} border rounded-[28px] p-5`}>
                  <Text className={`${textClass} text-lg font-semibold`}>Typical Green River track shape</Text>
                  <Text className={`${secondaryTextClass} text-sm mt-1`}>
                    Use this as the base skeleton, then layer the major-specific checklist items on top.
                  </Text>

                  <View className="gap-3 mt-4">
                    {track.terms.map((term) => (
                      <View key={`${track.id}-${term.label}`} className={`border ${borderClass} rounded-2xl px-4 py-4`}>
                        <Text className={`${textClass} font-semibold`}>{term.label}</Text>
                        <Text className={`${secondaryTextClass} text-sm mt-2`}>
                          {term.courses.join(" • ")}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {track.notes.length ? (
                    <View className="gap-2 mt-4">
                      {track.notes.map((note) => (
                        <Text key={note} className={`${secondaryTextClass} text-xs`}>
                          • {note}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                </View>
              ) : null}

              <ChecklistSection
                title="Finish before you apply"
                subtitle="These are the items the planner treats as the strongest application-floor checklist for this path."
                items={plan.applicationChecklist}
                majorId={plan.id}
                progress={progress}
                onToggle={toggleItem}
                textClass={textClass}
                secondaryTextClass={secondaryTextClass}
                cardClass={cardBgClass}
                borderClass={borderClass}
              />

              <ChecklistSection
                title="Finish before UW starts"
                subtitle="These items are the next things to push at Green River when the student wants the cleanest launch after admission."
                items={plan.beforeEnrollmentChecklist}
                majorId={plan.id}
                progress={progress}
                onToggle={toggleItem}
                textClass={textClass}
                secondaryTextClass={secondaryTextClass}
                cardClass={cardBgClass}
                borderClass={borderClass}
              />

              <ChecklistSection
                title="Worth finishing at Green River"
                subtitle="These are the cheaper, cleaner, or easier lower-division classes the planner still tries to keep at Green River when possible."
                items={plan.stayAtGrcChecklist}
                majorId={plan.id}
                progress={progress}
                onToggle={toggleItem}
                textClass={textClass}
                secondaryTextClass={secondaryTextClass}
                cardClass={cardBgClass}
                borderClass={borderClass}
              />

              {plan.advisorFlags.length ? (
                <View className={`${cardBgClass} border rounded-[28px] p-5`}>
                  <Text className={`${textClass} text-lg font-semibold`}>Advisor flags</Text>
                  <Text className={`${secondaryTextClass} text-sm mt-1`}>
                    These are the spots where the UI should push the student back to an advisor instead of pretending the path is automatic.
                  </Text>

                  <View className="gap-3 mt-4">
                    {plan.advisorFlags.map((flag) => (
                      <StatusBanner
                        key={flag}
                        variant="warning"
                        message={flag}
                      />
                    ))}
                  </View>
                </View>
              ) : null}

              <View
                style={isDesktop ? { flexDirection: "row", alignItems: "stretch", gap: 16 } : { gap: 16 }}
              >
                <View
                  style={isDesktop ? { flex: 1, minWidth: 0 } : undefined}
                  className={`${cardBgClass} border rounded-[28px] p-5`}
                >
                  <Text className={`${textClass} text-lg font-semibold`}>Leadership and involvement</Text>
                  <Text className={`${secondaryTextClass} text-sm mt-1`}>
                    {"Lady Ivory's advising request was bigger than prerequisites. This section pushes students toward stronger Green River involvement too."}
                  </Text>

                  <View className="gap-2 mt-4">
                    {plan.involvementIdeas.map((idea) => (
                      <Text key={idea} className={`${secondaryTextClass} text-sm`}>
                        • {idea}
                      </Text>
                    ))}
                  </View>

                  <View className="gap-3 mt-4">
                    {TRANSFER_PLANNER_INVOLVEMENT_LINKS.map((link) => (
                      <Pressable
                        key={link.url}
                        onPress={() => {
                          void openExternalLink(link.url);
                        }}
                        className={`border ${borderClass} rounded-2xl px-4 py-4 flex-row items-start`}
                      >
                        <View className="w-9 h-9 rounded-full bg-emerald-500/10 items-center justify-center mr-3">
                          <Ionicons name="people-outline" size={18} color="#008f4e" />
                        </View>
                        <View className="flex-1 min-w-0">
                          <Text className={`${textClass} font-semibold`}>{link.label}</Text>
                          {link.note ? (
                            <Text className={`${secondaryTextClass} text-sm mt-1`}>{link.note}</Text>
                          ) : null}
                        </View>
                        <MaterialIcons name="open-in-new" size={18} color="#008f4e" />
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View
                  style={isDesktop ? { flex: 1, minWidth: 0 } : undefined}
                  className={`${cardBgClass} border rounded-[28px] p-5`}
                >
                  <Text className={`${textClass} text-lg font-semibold`}>Project ideas</Text>
                  <Text className={`${secondaryTextClass} text-sm mt-1`}>
                    Curated Green River-first ideas so the feature is useful even before AI personalization exists.
                  </Text>

                  <View className="gap-3 mt-4">
                    {plan.projectIdeas.map((idea) => (
                      <View key={idea} className={`border ${borderClass} rounded-2xl px-4 py-4`}>
                        <Text className={`${secondaryTextClass} text-sm`}>{idea}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>

              <View className={`${cardBgClass} border rounded-[28px] p-5`}>
                <Text className={`${textClass} text-lg font-semibold`}>Official source links</Text>
                <Text className={`${secondaryTextClass} text-sm mt-1`}>
                  Open the exact source pages the plan is built from before making year-sensitive advising changes.
                </Text>

                <View className="gap-3 mt-4">
                  {visibleOfficialLinks.map((link) => (
                    <Pressable
                      key={`${plan.id}-${link.url}`}
                      onPress={() => {
                        void openExternalLink(link.url);
                      }}
                      className={`border ${borderClass} rounded-2xl px-4 py-4 flex-row items-start`}
                    >
                      <View className="w-9 h-9 rounded-full bg-emerald-500/10 items-center justify-center mr-3">
                        <Ionicons name="link-outline" size={18} color="#008f4e" />
                      </View>
                      <View className="flex-1 min-w-0">
                        <Text className={`${textClass} font-semibold`}>{link.label}</Text>
                        {link.note ? (
                          <Text className={`${secondaryTextClass} text-sm mt-1`}>{link.note}</Text>
                        ) : null}
                      </View>
                      <MaterialIcons name="open-in-new" size={18} color="#008f4e" />
                    </Pressable>
                  ))}
                </View>
              </View>

              {plan.manualReviewNotes?.length ? (
                <View className={`${cardBgClass} border rounded-[28px] p-5`}>
                  <Text className={`${textClass} text-lg font-semibold`}>Still needs manual review</Text>
                  <Text className={`${secondaryTextClass} text-sm mt-1`}>
                    This is the part of the tool that is intentionally honest instead of pretending every campus has the same level of structured data.
                  </Text>

                  <View className="gap-3 mt-4">
                    {plan.manualReviewNotes.map((note) => (
                      <StatusBanner key={note} variant="warning" message={note} />
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}
