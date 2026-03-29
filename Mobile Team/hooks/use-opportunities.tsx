import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Opportunity, UserOpportunityStatus } from "@/constants/opportunities";
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
  setOpportunityDone: (opportunityId: string, isDone: boolean) => Promise<void>;
  isOpportunityDone: (opportunityId: string) => boolean;
};

const OpportunitiesContext = createContext<OpportunitiesContextValue | null>(null);

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

  const hydrate = useCallback(async () => {
    const catalog = await opportunitiesService.loadCatalog({ preferCache: true });
    const localStatuses = await opportunityStatusService.readLocalStatuses(userKey);

    setOpportunities(opportunitiesService.filterActiveCatalog(catalog.opportunities));
    setStatusById(localStatuses);
    setIsHydrated(true);

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
  }, [signedInUid, userKey]);

  const refreshOpportunities = useCallback(async () => {
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
    } finally {
      setIsRefreshing(false);
    }
  }, [signedInUid]);

  useEffect(() => {
    if (!isAppHydrated) return;
    void hydrate();
    void refreshOpportunities();
  }, [hydrate, isAppHydrated, refreshOpportunities]);

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

  const setOpportunityDone = useCallback(
    async (opportunityId: string, isDone: boolean) => {
      const opportunity = opportunitiesService.findOpportunityById(
        opportunities,
        opportunityId
      );
      if (!opportunity) return;

      const actingUserId = signedInUid ?? userKey;
      const nextStatus = opportunityStatusService.buildStatus(
        actingUserId,
        opportunity,
        isDone,
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
            isDone,
          },
        });
      }
    },
    [opportunities, signedInUid, statusById, userKey]
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
