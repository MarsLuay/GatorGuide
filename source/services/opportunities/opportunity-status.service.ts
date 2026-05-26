import { localStorageService } from "@/services/storage/local-storage.service";
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import {
  type Opportunity,
  type OpportunityProgressState,
  type UserOpportunityStatus,
  isCompletedOpportunityProgress,
  normalizeUserOpportunityStatus,
  OPPORTUNITY_PROGRESS_STATES,
  resolveOpportunityCycleKey,
} from "@/constants/opportunities";
import {
  FIRESTORE_COLLECTIONS,
  FIRESTORE_USER_SUBCOLLECTIONS,
} from "@/constants/schema";
import { db } from "@/services/firebase/firebase";
import {
  GUEST_OPPORTUNITY_USER_KEY,
  getOpportunityPendingStorageKey,
  getOpportunityStatusesStorageKey,
} from "@/services/storage/local-storage-contracts";

export type OpportunityStatusMap = Record<string, UserOpportunityStatus>;

type PendingOpportunityStatusMutation = {
  opportunityId: string;
  status: UserOpportunityStatus;
};

const GUEST_USER_KEY = GUEST_OPPORTUNITY_USER_KEY;

function compareClientUpdatedAt(
  left: Pick<UserOpportunityStatus, "clientUpdatedAt"> | null | undefined,
  right: Pick<UserOpportunityStatus, "clientUpdatedAt"> | null | undefined
) {
  const leftValue = String(left?.clientUpdatedAt ?? "");
  const rightValue = String(right?.clientUpdatedAt ?? "");
  return leftValue.localeCompare(rightValue);
}

class OpportunityStatusService {
  getGuestUserKey() {
    return GUEST_USER_KEY;
  }

  private getStatusesStorageKey(userKey: string) {
    return getOpportunityStatusesStorageKey(userKey);
  }

  private getPendingStorageKey(userKey: string) {
    return getOpportunityPendingStorageKey(userKey);
  }

  async readLocalStatuses(userKey: string): Promise<OpportunityStatusMap> {
    try {
      const raw = await localStorageService.getItem(this.getStatusesStorageKey(userKey));
      if (!raw) return {};
      const parsed = JSON.parse(raw) as OpportunityStatusMap;
      const entries = Object.entries(parsed ?? {}).map(([opportunityId, status]) => [
        opportunityId,
        normalizeUserOpportunityStatus(status, String(status?.userId ?? userKey), opportunityId),
      ]);
      return Object.fromEntries(entries);
    } catch {
      return {};
    }
  }

  async writeLocalStatuses(userKey: string, statuses: OpportunityStatusMap) {
    await localStorageService.setItem(
      this.getStatusesStorageKey(userKey),
      JSON.stringify(statuses)
    );
  }

  async clearLocalStatuses(userKey: string) {
    await localStorageService.removeItem(this.getStatusesStorageKey(userKey));
  }

  private reducePendingMutations(mutations: PendingOpportunityStatusMutation[]) {
    const latestByOpportunityId = new Map<string, PendingOpportunityStatusMutation>();
    for (const mutation of mutations) {
      const opportunityId = String(mutation?.opportunityId ?? "").trim();
      if (!opportunityId) continue;
      const existing = latestByOpportunityId.get(opportunityId);
      if (
        !existing ||
        compareClientUpdatedAt(existing.status, mutation.status) <= 0
      ) {
        latestByOpportunityId.set(opportunityId, mutation);
      }
    }

    return Array.from(latestByOpportunityId.values());
  }

  async readPendingMutations(userKey: string) {
    try {
      const raw = await localStorageService.getItem(this.getPendingStorageKey(userKey));
      if (!raw) return [];
      const parsed = JSON.parse(raw) as PendingOpportunityStatusMutation[];
      return this.reducePendingMutations(Array.isArray(parsed) ? parsed : []);
    } catch {
      return [];
    }
  }

  async writePendingMutations(
    userKey: string,
    mutations: PendingOpportunityStatusMutation[]
  ) {
    const reduced = this.reducePendingMutations(mutations);
    const storageKey = this.getPendingStorageKey(userKey);
    if (!reduced.length) {
      await localStorageService.removeItem(storageKey);
      return;
    }
    await localStorageService.setItem(storageKey, JSON.stringify(reduced));
  }

  async queueStatusMutation(userKey: string, status: UserOpportunityStatus) {
    const pending = await this.readPendingMutations(userKey);
    pending.push({
      opportunityId: status.opportunityId,
      status,
    });
    await this.writePendingMutations(userKey, pending);
  }

  async clearPendingMutation(userKey: string, opportunityId: string) {
    const pending = await this.readPendingMutations(userKey);
    await this.writePendingMutations(
      userKey,
      pending.filter((item) => item.opportunityId !== opportunityId)
    );
  }

  async clearPendingMutations(userKey: string) {
    await localStorageService.removeItem(this.getPendingStorageKey(userKey));
  }

  mergeStatusMaps(
    primary: OpportunityStatusMap,
    secondary: OpportunityStatusMap
  ): OpportunityStatusMap {
    const merged: OpportunityStatusMap = { ...(primary ?? {}) };
    for (const [opportunityId, status] of Object.entries(secondary ?? {})) {
      const existing = merged[opportunityId];
      if (!existing || compareClientUpdatedAt(existing, status) <= 0) {
        merged[opportunityId] = status;
      }
    }
    return merged;
  }

  async getRemoteStatuses(uid: string): Promise<OpportunityStatusMap> {
    if (!db || !uid) return {};
    const snapshot = await getDocs(
      collection(
        db,
        FIRESTORE_COLLECTIONS.users,
        uid,
        FIRESTORE_USER_SUBCOLLECTIONS.opportunityStatuses
      )
    );
    return Object.fromEntries(
      snapshot.docs.map((item) => {
        const status = normalizeUserOpportunityStatus(
          item.data() as Partial<UserOpportunityStatus>,
          uid,
          item.id
        );
        return [item.id, status];
      })
    );
  }

  async saveRemoteStatus(uid: string, status: UserOpportunityStatus) {
    if (!db || !uid) return;
    await setDoc(
      doc(
        db,
        FIRESTORE_COLLECTIONS.users,
        uid,
        FIRESTORE_USER_SUBCOLLECTIONS.opportunityStatuses,
        status.opportunityId
      ),
      {
        schemaVersion: status.schemaVersion,
        userId: uid,
        opportunityId: status.opportunityId,
        progress: status.progress,
        progressUpdatedAt: status.progressUpdatedAt,
        isDone: status.isDone,
        doneAt: status.doneAt,
        doneCycleKey: status.doneCycleKey,
        clientUpdatedAt: status.clientUpdatedAt,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  buildProgressStatus(
    userId: string,
    opportunity: Opportunity,
    progress: OpportunityProgressState,
    existing?: UserOpportunityStatus | null
  ) {
    const nowIso = new Date().toISOString();
    const isDone = isCompletedOpportunityProgress(progress);

    return normalizeUserOpportunityStatus(
      {
        ...(existing ?? {}),
        progress,
        progressUpdatedAt: nowIso,
        isDone,
        doneAt: isDone ? nowIso : null,
        doneCycleKey: resolveOpportunityCycleKey(opportunity),
        clientUpdatedAt: nowIso,
      },
      userId,
      opportunity.opportunityId
    );
  }

  buildStatus(
    userId: string,
    opportunity: Opportunity,
    isDone: boolean,
    existing?: UserOpportunityStatus | null
  ) {
    return this.buildProgressStatus(
      userId,
      opportunity,
      isDone
        ? OPPORTUNITY_PROGRESS_STATES.submitted
        : OPPORTUNITY_PROGRESS_STATES.saved,
      existing
    );
  }

  private applyPendingMutations(
    base: OpportunityStatusMap,
    pending: PendingOpportunityStatusMutation[]
  ) {
    const pendingMap = Object.fromEntries(
      pending.map((item) => [item.opportunityId, item.status])
    );
    return this.mergeStatusMaps(base, pendingMap);
  }

  async syncStatuses(
    uid: string,
    localStatuses: OpportunityStatusMap,
    options: {
      userKey?: string;
      promoteStatuses?: OpportunityStatusMap;
    } = {}
  ) {
    const userKey = options.userKey ?? uid;
    if (!uid || !db) {
      return {
        statuses: localStatuses,
        remainingPending: [] as PendingOpportunityStatusMutation[],
      };
    }

    const remoteStatuses = await this.getRemoteStatuses(uid);
    const pendingMutations = await this.readPendingMutations(userKey);
    const promotedStatuses = options.promoteStatuses ?? {};
    const mergedBase = this.mergeStatusMaps(
      remoteStatuses,
      this.mergeStatusMaps(localStatuses, promotedStatuses)
    );
    const mergedStatuses = this.applyPendingMutations(mergedBase, pendingMutations);

    const uploadCandidates = Object.values(mergedStatuses).filter((status) => {
      const remote = remoteStatuses[status.opportunityId];
      return !remote || compareClientUpdatedAt(remote, status) < 0;
    });

    if (uploadCandidates.length) {
      const results = await Promise.allSettled(
        uploadCandidates.map(async (status) => {
          await this.saveRemoteStatus(uid, status);
          return status.opportunityId;
        })
      );

      const completedIds = new Set(
        results
          .filter((result) => result.status === "fulfilled")
          .map((result) => result.value)
      );

      await this.writePendingMutations(
        userKey,
        pendingMutations.filter(
          (mutation) => !completedIds.has(mutation.opportunityId)
        )
      );
    }

    return {
      statuses: mergedStatuses,
      remainingPending: await this.readPendingMutations(userKey),
    };
  }
}

export const opportunityStatusService = new OpportunityStatusService();
