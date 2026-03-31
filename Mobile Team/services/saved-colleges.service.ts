import AsyncStorage from "@react-native-async-storage/async-storage";
import { collection, deleteDoc, deleteField, doc, getDocs, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import {
  FIRESTORE_COLLECTIONS,
  FIRESTORE_USER_SUBCOLLECTIONS,
  getSavedCollegesPendingStorageKey,
} from "@/constants/schema";
import { collegeService, type College } from "./college.service";
import { db } from "./firebase";
import { normalizeRateValue } from "@/utils/locale-format";

type SavedCollegeSnapshot = Omit<College, "raw"> & {
  collegeId: string;
};

type PendingSavedCollegeMutation =
  | {
      collegeId: string;
      type: "save";
      college: SavedCollegeSnapshot;
      timestamp: string;
    }
  | {
      collegeId: string;
      type: "remove";
      timestamp: string;
    };

export type SyncSavedCollegesOptions = {
  includeLocalSnapshot?: boolean;
};

const uniqueStrings = (values: string[] | undefined | null) =>
  Array.from(
    new Set(
      (values ?? [])
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
    )
  );

const normalizeCollegeId = (value: unknown): string | null => {
  const parsed = String(value ?? "").trim();
  return parsed ? parsed : null;
};

const normalizeNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeString = (value: unknown): string | null => {
  const parsed = String(value ?? "").trim();
  return parsed ? parsed : null;
};

const pickDefined = <T>(primary: T | null | undefined, fallback: T | null | undefined): T | null | undefined =>
  primary !== undefined && primary !== null && primary !== ("" as unknown as T) ? primary : fallback;

const normalizeCollegeLocation = (value: College["location"] | undefined | null) => ({
  city: String(value?.city ?? "").trim(),
  state: String(value?.state ?? "").trim(),
});

function mergeCollegeSnapshot(base: College, incoming: College): College {
  return {
    ...base,
    ...incoming,
    location: {
      city: String(pickDefined(incoming.location?.city, base.location?.city) ?? "").trim(),
      state: String(pickDefined(incoming.location?.state, base.location?.state) ?? "").trim(),
    },
    tuition: pickDefined(incoming.tuition, base.tuition) ?? null,
    tuitionInState: pickDefined(incoming.tuitionInState, base.tuitionInState) ?? null,
    tuitionOutOfState: pickDefined(incoming.tuitionOutOfState, base.tuitionOutOfState) ?? null,
    studentSize: pickDefined(incoming.studentSize, base.studentSize) ?? null,
    admissionRate: pickDefined(incoming.admissionRate, base.admissionRate) ?? null,
    completionRate: pickDefined(incoming.completionRate, base.completionRate) ?? null,
    website: pickDefined(incoming.website, base.website) ?? null,
    priceCalculator: pickDefined(incoming.priceCalculator, base.priceCalculator) ?? null,
    programs: uniqueStrings([...(base.programs ?? []), ...(incoming.programs ?? [])]),
    matchScore: pickDefined(incoming.matchScore, base.matchScore) ?? undefined,
    degreesAwarded: incoming.degreesAwarded ?? base.degreesAwarded ?? null,
    locale: pickDefined(incoming.locale, base.locale) ?? null,
    avgNetPriceOverall: pickDefined(incoming.avgNetPriceOverall, base.avgNetPriceOverall) ?? null,
    attendanceAcademicYear: pickDefined(incoming.attendanceAcademicYear, base.attendanceAcademicYear) ?? null,
    pellGrantRate: pickDefined(incoming.pellGrantRate, base.pellGrantRate) ?? null,
    medianDebtCompletersOverall: pickDefined(incoming.medianDebtCompletersOverall, base.medianDebtCompletersOverall) ?? null,
    raw: incoming.raw ?? base.raw,
  };
}

function createSavedCollegeFallback(collegeId: string): College {
  return {
    id: String(collegeId),
    name: "Saved College",
    location: { city: "", state: "" },
    tuition: null,
    size: "unknown",
    setting: "suburban",
    admissionRate: null,
    programs: [],
  };
}

function toSavedCollegeSnapshot(college: College): SavedCollegeSnapshot {
  return {
    collegeId: String(college.id),
    id: String(college.id),
    name: String(college.name ?? "").trim() || "Unknown College",
    location: normalizeCollegeLocation(college.location),
    lat: normalizeNumber(college.lat),
    lon: normalizeNumber(college.lon),
    tuition: normalizeNumber(college.tuition),
    tuitionInState: normalizeNumber(college.tuitionInState),
    tuitionOutOfState: normalizeNumber(college.tuitionOutOfState),
    studentSize: normalizeNumber(college.studentSize),
    size: college.size ?? "unknown",
    setting: college.setting ?? "suburban",
    admissionRate: normalizeRateValue(normalizeNumber(college.admissionRate)),
    completionRate: normalizeRateValue(normalizeNumber(college.completionRate)),
    website: normalizeString(college.website),
    priceCalculator: normalizeString(college.priceCalculator),
    programs: uniqueStrings(college.programs),
    ...(typeof college.matchScore === "number" ? { matchScore: college.matchScore } : {}),
    ...(college.degreesAwarded ? { degreesAwarded: college.degreesAwarded } : {}),
    ...(college.locale ? { locale: college.locale } : {}),
    ...(college.avgNetPriceOverall != null ? { avgNetPriceOverall: college.avgNetPriceOverall } : {}),
    ...(college.attendanceAcademicYear != null ? { attendanceAcademicYear: college.attendanceAcademicYear } : {}),
    ...(college.pellGrantRate != null ? { pellGrantRate: normalizeRateValue(college.pellGrantRate) } : {}),
    ...(college.medianDebtCompletersOverall != null ? { medianDebtCompletersOverall: college.medianDebtCompletersOverall } : {}),
  };
}

function fromSavedCollegeSnapshot(collegeId: string, snapshot: Partial<SavedCollegeSnapshot>): College {
  return {
    id: String(snapshot.id ?? collegeId),
    name: String(snapshot.name ?? "Unknown College"),
    location: normalizeCollegeLocation(snapshot.location),
    lat: normalizeNumber(snapshot.lat),
    lon: normalizeNumber(snapshot.lon),
    tuition: normalizeNumber(snapshot.tuition),
    tuitionInState: normalizeNumber(snapshot.tuitionInState),
    tuitionOutOfState: normalizeNumber(snapshot.tuitionOutOfState),
    studentSize: normalizeNumber(snapshot.studentSize),
    size: snapshot.size ?? "unknown",
    setting: snapshot.setting ?? "suburban",
    admissionRate: normalizeRateValue(normalizeNumber(snapshot.admissionRate)),
    completionRate: normalizeRateValue(normalizeNumber(snapshot.completionRate)),
    website: normalizeString(snapshot.website),
    priceCalculator: normalizeString(snapshot.priceCalculator),
    programs: uniqueStrings(snapshot.programs),
    ...(typeof snapshot.matchScore === "number" ? { matchScore: snapshot.matchScore } : {}),
    ...(snapshot.degreesAwarded ? { degreesAwarded: snapshot.degreesAwarded } : {}),
    ...(snapshot.locale ? { locale: snapshot.locale } : {}),
    ...(snapshot.avgNetPriceOverall != null ? { avgNetPriceOverall: snapshot.avgNetPriceOverall } : {}),
    ...(snapshot.attendanceAcademicYear != null ? { attendanceAcademicYear: snapshot.attendanceAcademicYear } : {}),
    ...(snapshot.pellGrantRate != null ? { pellGrantRate: normalizeRateValue(snapshot.pellGrantRate) } : {}),
    ...(snapshot.medianDebtCompletersOverall != null
      ? { medianDebtCompletersOverall: snapshot.medianDebtCompletersOverall }
      : {}),
  };
}

function snapshotsEqual(left: College, right: College) {
  return JSON.stringify(toSavedCollegeSnapshot(left)) === JSON.stringify(toSavedCollegeSnapshot(right));
}

class SavedCollegesService {
  private getPendingMutationsStorageKey(uid: string) {
    return getSavedCollegesPendingStorageKey(uid);
  }

  private reducePendingMutations(mutations: PendingSavedCollegeMutation[]) {
    const latestByCollegeId = new Map<string, PendingSavedCollegeMutation>();

    for (const mutation of mutations) {
      if (!mutation?.collegeId) continue;
      const existing = latestByCollegeId.get(mutation.collegeId);
      if (!existing || existing.timestamp <= mutation.timestamp) {
        latestByCollegeId.set(mutation.collegeId, mutation);
      }
    }

    return Array.from(latestByCollegeId.values()).sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  }

  private async readPendingMutations(uid: string): Promise<PendingSavedCollegeMutation[]> {
    if (!uid) return [];

    try {
      const raw = await AsyncStorage.getItem(this.getPendingMutationsStorageKey(uid));
      if (!raw) return [];
      const parsed = JSON.parse(raw) as PendingSavedCollegeMutation[];
      return this.reducePendingMutations(Array.isArray(parsed) ? parsed : []);
    } catch {
      return [];
    }
  }

  private async writePendingMutations(uid: string, mutations: PendingSavedCollegeMutation[]) {
    if (!uid) return;

    const reduced = this.reducePendingMutations(mutations);
    const storageKey = this.getPendingMutationsStorageKey(uid);

    if (reduced.length === 0) {
      await AsyncStorage.removeItem(storageKey);
      return;
    }

    await AsyncStorage.setItem(storageKey, JSON.stringify(reduced));
  }

  private applyPendingMutations(base: College[], pendingMutations: PendingSavedCollegeMutation[]) {
    const merged = new Map((base ?? []).map((college) => [String(college.id), college]));

    for (const mutation of pendingMutations) {
      const collegeId = String(mutation.collegeId);
      if (mutation.type === "remove") {
        merged.delete(collegeId);
        continue;
      }

      const incoming = fromSavedCollegeSnapshot(collegeId, mutation.college);
      const existing = merged.get(collegeId);
      merged.set(collegeId, existing ? mergeCollegeSnapshot(existing, incoming) : incoming);
    }

    return Array.from(merged.values());
  }

  mergeSavedCollegeLists(primary: College[], secondary: College[]): College[] {
    const merged = new Map<string, College>();

    for (const college of primary ?? []) {
      merged.set(String(college.id), college);
    }

    for (const college of secondary ?? []) {
      const existing = merged.get(String(college.id));
      merged.set(String(college.id), existing ? mergeCollegeSnapshot(existing, college) : college);
    }

    return Array.from(merged.values());
  }

  private mergeRemoteWithPromotedLocalSnapshot(remoteBase: College[], localSavedColleges: College[]) {
    const merged = new Map<string, College>();

    for (const college of remoteBase ?? []) {
      merged.set(String(college.id), college);
    }

    for (const college of localSavedColleges ?? []) {
      const collegeId = String(college.id);
      const existing = merged.get(collegeId);
      if (!existing) {
        merged.set(collegeId, college);
        continue;
      }

      // During guest-to-account promotion, preserve the signed-in remote snapshot
      // as authoritative while still filling any missing local fields.
      merged.set(collegeId, mergeCollegeSnapshot(college, existing));
    }

    return Array.from(merged.values());
  }

  async getUserSavedColleges(uid: string): Promise<College[]> {
    if (!db || !uid) return [];

    const snapshot = await getDocs(
      collection(
        db,
        FIRESTORE_COLLECTIONS.users,
        uid,
        FIRESTORE_USER_SUBCOLLECTIONS.savedColleges
      )
    );
    return snapshot.docs.map((savedDoc) =>
      fromSavedCollegeSnapshot(savedDoc.id, savedDoc.data() as Partial<SavedCollegeSnapshot>)
    );
  }

  async saveCollege(uid: string, college: College): Promise<void> {
    if (!db || !uid) return;

    const ref = doc(
      db,
      FIRESTORE_COLLECTIONS.users,
      uid,
      FIRESTORE_USER_SUBCOLLECTIONS.savedColleges,
      String(college.id)
    );
    await setDoc(
      ref,
      {
        ...toSavedCollegeSnapshot(college),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  async removeCollege(uid: string, collegeId: string): Promise<void> {
    if (!db || !uid || !collegeId) return;
    await deleteDoc(
      doc(
        db,
        FIRESTORE_COLLECTIONS.users,
        uid,
        FIRESTORE_USER_SUBCOLLECTIONS.savedColleges,
        String(collegeId)
      )
    );
  }

  async queueSaveCollege(uid: string, college: College): Promise<void> {
    if (!uid) return;
    const pending = await this.readPendingMutations(uid);
    pending.push({
      collegeId: String(college.id),
      type: "save",
      college: toSavedCollegeSnapshot(college),
      timestamp: new Date().toISOString(),
    });
    await this.writePendingMutations(uid, pending);
  }

  async queueRemoveCollege(uid: string, collegeId: string): Promise<void> {
    if (!uid || !collegeId) return;
    const pending = await this.readPendingMutations(uid);
    pending.push({
      collegeId: String(collegeId),
      type: "remove",
      timestamp: new Date().toISOString(),
    });
    await this.writePendingMutations(uid, pending);
  }

  async clearPendingMutation(uid: string, collegeId: string): Promise<void> {
    if (!uid || !collegeId) return;
    const pending = await this.readPendingMutations(uid);
    await this.writePendingMutations(
      uid,
      pending.filter((mutation) => mutation.collegeId !== String(collegeId))
    );
  }

  async clearPendingSyncState(uid: string): Promise<void> {
    if (!uid) return;
    await AsyncStorage.removeItem(this.getPendingMutationsStorageKey(uid));
  }

  async clearLegacySavedCollegesField(uid: string): Promise<void> {
    if (!db || !uid) return;
    await updateDoc(doc(db, FIRESTORE_COLLECTIONS.users, uid), {
      savedColleges: deleteField(),
    }).catch(() => {});
  }

  private async resolveLegacySavedColleges(legacySavedCollegeIds: string[], existingColleges: College[]): Promise<College[]> {
    const existingIds = new Set((existingColleges ?? []).map((college) => String(college.id)));
    const missingIds = uniqueStrings(
      (legacySavedCollegeIds ?? [])
        .map((collegeId) => normalizeCollegeId(collegeId))
        .filter((collegeId): collegeId is string => !!collegeId)
    ).filter((collegeId) => !existingIds.has(collegeId));

    if (missingIds.length === 0) return [];

    const resolved = await Promise.all(
      missingIds.map(async (collegeId) => {
        try {
          return await collegeService.getCollegeDetails(collegeId);
        } catch {
          return createSavedCollegeFallback(collegeId);
        }
      })
    );

    return resolved;
  }

  /**
   * Reconciliation rules:
   * 1. Remote Firebase data is the default source of truth for signed-in users.
   * 2. Local snapshots are only promoted into Firebase when explicitly requested
   *    (for guest/offline-to-account handoff on sign-in).
   * 3. Explicit queued local mutations always win over the fetched remote state.
   * 4. Removals are never inferred from a missing local item alone, which prevents
   *    stale local caches from silently resurrecting remote deletions.
   */
  async syncSavedColleges(
    uid: string,
    localSavedColleges: College[],
    legacySavedCollegeIds: string[] = [],
    options: SyncSavedCollegesOptions = {}
  ): Promise<College[]> {
    if (!db || !uid) return this.mergeSavedCollegeLists([], localSavedColleges ?? []);

    const remoteSavedColleges = await this.getUserSavedColleges(uid);
    const pendingMutations = await this.readPendingMutations(uid);
    const legacySavedColleges = await this.resolveLegacySavedColleges(
      legacySavedCollegeIds,
      this.mergeSavedCollegeLists(remoteSavedColleges, localSavedColleges ?? [])
    );
    const remoteBase = this.mergeSavedCollegeLists(remoteSavedColleges, legacySavedColleges);
    const desiredBase = options.includeLocalSnapshot
      ? this.mergeRemoteWithPromotedLocalSnapshot(remoteBase, localSavedColleges ?? [])
      : remoteBase;
    const merged = this.applyPendingMutations(
      desiredBase,
      pendingMutations
    );

    const remoteById = new Map(remoteSavedColleges.map((college) => [String(college.id), college]));
    const pendingById = new Map(pendingMutations.map((mutation) => [mutation.collegeId, mutation]));
    const pendingRemovalIds = new Set(
      pendingMutations
        .filter((mutation) => mutation.type === "remove")
        .map((mutation) => mutation.collegeId)
    );
    const toUpload = merged.filter((college) => {
      const remote = remoteById.get(String(college.id));
      const pending = pendingById.get(String(college.id));
      return (
        pending?.type === "save" ||
        !remote ||
        !snapshotsEqual(remote, college)
      );
    });
    const toDelete = Array.from(pendingRemovalIds).filter((collegeId) => remoteById.has(collegeId));

    const uploadedCollegeIds = new Set<string>();
    const deletedCollegeIds = new Set<string>();

    if (toUpload.length > 0) {
      const uploadResults = await Promise.allSettled(
        toUpload.map(async (college) => {
          await this.saveCollege(uid, college);
          return String(college.id);
        })
      );

      for (const result of uploadResults) {
        if (result.status === "fulfilled") {
          uploadedCollegeIds.add(result.value);
        }
      }
    }

    if (toDelete.length > 0) {
      const deleteResults = await Promise.allSettled(
        toDelete.map(async (collegeId) => {
          await this.removeCollege(uid, collegeId);
          return collegeId;
        })
      );

      for (const result of deleteResults) {
        if (result.status === "fulfilled") {
          deletedCollegeIds.add(result.value);
        }
      }
    }

    if (pendingMutations.length > 0) {
      const completedMutationIds = new Set<string>();

      for (const mutation of pendingMutations) {
        if (mutation.type === "save") {
          const resolvedCollege = merged.find((college) => String(college.id) === mutation.collegeId);
          const remoteCollege = remoteById.get(mutation.collegeId);
          if (
            uploadedCollegeIds.has(mutation.collegeId) ||
            (resolvedCollege && remoteCollege && snapshotsEqual(remoteCollege, resolvedCollege))
          ) {
            completedMutationIds.add(mutation.collegeId);
          }
          continue;
        }

        if (!remoteById.has(mutation.collegeId) || deletedCollegeIds.has(mutation.collegeId)) {
          completedMutationIds.add(mutation.collegeId);
        }
      }

      if (completedMutationIds.size > 0) {
        await this.writePendingMutations(
          uid,
          pendingMutations.filter((mutation) => !completedMutationIds.has(mutation.collegeId))
        );
      }
    }

    if (legacySavedCollegeIds.length > 0) {
      await this.clearLegacySavedCollegesField(uid);
    }

    return merged;
  }
}

export const savedCollegesService = new SavedCollegesService();
