import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type Opportunity,
  type OpportunityProgressState,
  type UserOpportunityStatus,
  OPPORTUNITY_PROGRESS_STATES,
} from "@/constants/opportunities";
import {
  type MatchedOpportunity,
  opportunityMatchingService,
} from "@/services/opportunity-matching.service";
import { opportunitiesService } from "@/services/opportunities.service";
import {
  type OpportunityStatusMap,
  opportunityStatusService,
} from "@/services/opportunity-status.service";
import { errorLoggingService, notificationsService } from "@/services";
import { useAppData } from "./use-app-data";

type OpportunitiesContextValue = {
  isHydrated: boolean;
  isRefreshing: boolean;
  opportunities: Opportunity[];
  matchedOpportunities: MatchedOpportunity[];
  statusById: OpportunityStatusMap;
  refreshOpportunities: () => Promise<void>;
  refreshOpportunitiesIfNeeded: (options?: { maxAgeMs?: number }) => Promise<void>;
  setOpportunityProgress: (
    opportunityId: string,
    progress: OpportunityProgressState
  ) => Promise<void>;
  setOpportunityDone: (opportunityId: string, isDone: boolean) => Promise<void>;
  isOpportunityDone: (opportunityId: string) => boolean;
};

const OpportunitiesContext = createContext<OpportunitiesContextValue | null>(null);
const DEFAULT_BACKGROUND_REFRESH_MAX_AGE_MS = 15 * 60 * 1000;

function hasStatuses(statuses: OpportunityStatusMap) {
  return Object.keys(statuses ?? {}).length > 0;
}

export function OpportunitiesProvider({ children }: { children: React.ReactNode }) {
  const { isHydrated: isAppHydrated, state } = useAppData();
  const [isHydrated, setIsHydrated] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [statusById, setStatusById] = useState<Record<string, UserOpportunityStatus>>({});
  const seedAttemptedRef = useRef(false);
  const deadlineEnsureInFlightRef = useRef<Set<string>>(new Set());
  const refreshPromiseRef = useRef<Promise<void> | null>(null);
  const lastCatalogSyncAtRef = useRef(0);
  const lastRefreshAttemptAtRef = useRef(0);

  const signedInUid = state.user?.uid && !state.user.isGuest ? state.user.uid : null;
  const userKey = signedInUid ?? opportunityStatusService.getGuestUserKey();

  useEffect(() => {
    seedAttemptedRef.current = false;
    deadlineEnsureInFlightRef.current.clear();
  }, [signedInUid]);

  const matchedOpportunities = useMemo(
    () =>
      opportunityMatchingService.matchOpportunities(opportunities, {
        user: state.user,
        questionnaireAnswers: state.questionnaireAnswers,
        statusById,
      }),
    [opportunities, state.user, state.questionnaireAnswers, statusById]
  );

  const recordCatalogSyncTime = useCallback((value: string | null | undefined) => {
    const parsed = value ? Date.parse(value) : Number.NaN;
    lastCatalogSyncAtRef.current = Number.isFinite(parsed) ? parsed : Date.now();
  }, []);

  const hydrate = useCallback(async () => {
    const catalog = await opportunitiesService.loadCatalog({ preferCache: true });
    const localStatuses = await opportunityStatusService.readLocalStatuses(userKey);

    setOpportunities(opportunitiesService.filterActiveCatalog(catalog.opportunities));
    setStatusById(localStatuses);
    setIsHydrated(true);
    recordCatalogSyncTime(catalog.fetchedAt);

    if (!signedInUid) return;

    try {
      const guestStatuses = await opportunityStatusService.readLocalStatuses(
        opportunityStatusService.getGuestUserKey()
      );
      const synced = await opportunityStatusService.syncStatuses(
        signedInUid,
        localStatuses,
        {
          userKey: signedInUid,
          promoteStatuses: guestStatuses,
        }
      );
      setStatusById(synced.statuses);
      await opportunityStatusService.writeLocalStatuses(signedInUid, synced.statuses);

      if (hasStatuses(guestStatuses)) {
        await opportunityStatusService.clearLocalStatuses(
          opportunityStatusService.getGuestUserKey()
        );
        await opportunityStatusService.clearPendingMutations(
          opportunityStatusService.getGuestUserKey()
        );
      }
    } catch (error) {
      void errorLoggingService.captureException(error, {
        category: "sync",
        operation: "hydrate-opportunity-statuses",
        severity: "warn",
        handled: true,
        source: "use-opportunities",
        metadata: {
          signedInUid,
        },
      });
    }
  }, [recordCatalogSyncTime, signedInUid, userKey]);

  const refreshOpportunities = useCallback(async () => {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const refreshTask = (async () => {
      lastRefreshAttemptAtRef.current = Date.now();
      setIsRefreshing(true);
      try {
        let refreshed = await opportunitiesService.refreshCatalog();

        if (
          signedInUid &&
          !seedAttemptedRef.current &&
          !opportunitiesService.findOpportunityById(
            refreshed.opportunities,
            "green-river-foundation-scholarship"
          )
        ) {
          seedAttemptedRef.current = true;
          try {
            const seeded = await opportunitiesService.ensureGreenRiverFoundationScholarshipSeeded();
            if (seeded) refreshed = seeded;
          } catch (error) {
            void errorLoggingService.captureException(error, {
              category: "sync",
              operation: "seed-green-river-foundation-scholarship",
              severity: "warn",
              handled: true,
              source: "use-opportunities",
            });
          }
        }

        setOpportunities(opportunitiesService.filterActiveCatalog(refreshed.opportunities));
        recordCatalogSyncTime(refreshed.fetchedAt);
      } finally {
        setIsRefreshing(false);
        refreshPromiseRef.current = null;
      }
    })();

    refreshPromiseRef.current = refreshTask;
    return refreshTask;
  }, [recordCatalogSyncTime, signedInUid]);

  const refreshOpportunitiesIfNeeded = useCallback(
    async (options: { maxAgeMs?: number } = {}) => {
      const maxAgeMs =
        options.maxAgeMs ?? DEFAULT_BACKGROUND_REFRESH_MAX_AGE_MS;
      const referenceTime = Math.max(
        lastCatalogSyncAtRef.current,
        lastRefreshAttemptAtRef.current
      );

      if (
        isHydrated &&
        opportunities.length > 0 &&
        referenceTime > 0 &&
        Date.now() - referenceTime < maxAgeMs
      ) {
        return;
      }

      await refreshOpportunities();
    },
    [isHydrated, opportunities.length, refreshOpportunities]
  );

  useEffect(() => {
    if (!isAppHydrated) return;
    let cancelled = false;
    void (async () => {
      await hydrate();
      if (cancelled) return;
      await refreshOpportunitiesIfNeeded();
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrate, isAppHydrated, refreshOpportunitiesIfNeeded]);

  useEffect(() => {
    if (!isAppHydrated || !isHydrated || !signedInUid) return;

    const missingColleges = (state.savedColleges ?? []).filter(
      (college) =>
        !opportunitiesService.findCollegeDeadlineOpportunity(opportunities, college.id) &&
        !deadlineEnsureInFlightRef.current.has(String(college.id))
    );

    if (!missingColleges.length) return;

    let cancelled = false;
    void (async () => {
      for (const college of missingColleges) {
        const collegeId = String(college.id);
        deadlineEnsureInFlightRef.current.add(collegeId);
        try {
          const refreshed = await opportunitiesService.ensureCollegeDeadlineOpportunity({
            collegeId,
            collegeName: college.name,
            collegeWebsite: college.website ?? null,
          });
          if (!cancelled && refreshed) {
            setOpportunities(
              opportunitiesService.filterActiveCatalog(refreshed.opportunities)
            );
          }
        } catch (error) {
          void errorLoggingService.captureException(error, {
            category: "sync",
            operation: "ensure-college-deadline-opportunity",
            severity: "warn",
            handled: true,
            source: "use-opportunities",
            metadata: {
              collegeId,
              collegeName: college.name,
            },
          });
        } finally {
          deadlineEnsureInFlightRef.current.delete(collegeId);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAppHydrated, isHydrated, opportunities, signedInUid, state.savedColleges]);

  useEffect(() => {
    if (!isAppHydrated || !isHydrated) return;

    void notificationsService
      .syncOpportunityNotifications({
        enabled: !!state.notificationsEnabled,
        opportunities,
        statuses: statusById,
      })
      .catch((error) => {
        void errorLoggingService.captureException(error, {
          category: "notifications",
          operation: "sync-opportunity-notifications",
          severity: "warn",
          handled: true,
          source: "use-opportunities",
          metadata: {
            opportunityCount: opportunities.length,
            notificationsEnabled: !!state.notificationsEnabled,
          },
        });
      });
  }, [isAppHydrated, isHydrated, opportunities, state.notificationsEnabled, statusById]);

  const setOpportunityProgress = useCallback(
    async (opportunityId: string, progress: OpportunityProgressState) => {
      const opportunity = opportunitiesService.findOpportunityById(
        opportunities,
        opportunityId
      );
      if (!opportunity) return;

      const actingUserId = signedInUid ?? userKey;
      const nextStatus = opportunityStatusService.buildProgressStatus(
        actingUserId,
        opportunity,
        progress,
        statusById[opportunityId]
      );
      const nextStatuses = {
        ...statusById,
        [opportunityId]: nextStatus,
      };

      setStatusById(nextStatuses);
      await opportunityStatusService.writeLocalStatuses(userKey, nextStatuses);

      if (!signedInUid) return;

      try {
        await opportunityStatusService.saveRemoteStatus(signedInUid, nextStatus);
        await opportunityStatusService.clearPendingMutation(
          signedInUid,
          opportunityId
        );
      } catch (error) {
        await opportunityStatusService.queueStatusMutation(signedInUid, nextStatus);
        void errorLoggingService.captureException(error, {
          category: "sync",
          operation: "persist-opportunity-status",
          severity: "warn",
          handled: true,
          source: "use-opportunities",
          metadata: {
            opportunityId,
            signedInUid,
            progress,
          },
        });
      }
    },
    [opportunities, signedInUid, statusById, userKey]
  );

  const setOpportunityDone = useCallback(
    async (opportunityId: string, isDone: boolean) => {
      await setOpportunityProgress(
        opportunityId,
        isDone
          ? OPPORTUNITY_PROGRESS_STATES.submitted
          : OPPORTUNITY_PROGRESS_STATES.saved
      );
    },
    [setOpportunityProgress]
  );

  const isOpportunityDone = useCallback(
    (opportunityId: string) => !!statusById[opportunityId]?.isDone,
    [statusById]
  );

  const value = useMemo<OpportunitiesContextValue>(
    () => ({
      isHydrated,
      isRefreshing,
      opportunities,
      matchedOpportunities,
      statusById,
      refreshOpportunities,
      refreshOpportunitiesIfNeeded,
      setOpportunityProgress,
      setOpportunityDone,
      isOpportunityDone,
    }),
    [
      isHydrated,
      isRefreshing,
      opportunities,
      matchedOpportunities,
      statusById,
      refreshOpportunities,
      refreshOpportunitiesIfNeeded,
      setOpportunityProgress,
      setOpportunityDone,
      isOpportunityDone,
    ]
  );

  return (
    <OpportunitiesContext.Provider value={value}>
      {children}
    </OpportunitiesContext.Provider>
  );
}

export function useOpportunities() {
  const context = useContext(OpportunitiesContext);
  if (!context) {
    throw new Error("useOpportunities must be used within OpportunitiesProvider");
  }
  return context;
}
