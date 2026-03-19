import { collection, deleteDoc, deleteField, doc, getDocs, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { collegeService, type College } from "./college.service";
import { db } from "./firebase";

const SAVED_COLLEGES_SUBCOLLECTION = "savedColleges";

type SavedCollegeSnapshot = Omit<College, "raw"> & {
  collegeId: string;
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
    admissionRate: normalizeNumber(college.admissionRate),
    completionRate: normalizeNumber(college.completionRate),
    website: normalizeString(college.website),
    priceCalculator: normalizeString(college.priceCalculator),
    programs: uniqueStrings(college.programs),
    ...(typeof college.matchScore === "number" ? { matchScore: college.matchScore } : {}),
    ...(college.degreesAwarded ? { degreesAwarded: college.degreesAwarded } : {}),
    ...(college.locale ? { locale: college.locale } : {}),
    ...(college.avgNetPriceOverall != null ? { avgNetPriceOverall: college.avgNetPriceOverall } : {}),
    ...(college.attendanceAcademicYear != null ? { attendanceAcademicYear: college.attendanceAcademicYear } : {}),
    ...(college.pellGrantRate != null ? { pellGrantRate: college.pellGrantRate } : {}),
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
    admissionRate: normalizeNumber(snapshot.admissionRate),
    completionRate: normalizeNumber(snapshot.completionRate),
    website: normalizeString(snapshot.website),
    priceCalculator: normalizeString(snapshot.priceCalculator),
    programs: uniqueStrings(snapshot.programs),
    ...(typeof snapshot.matchScore === "number" ? { matchScore: snapshot.matchScore } : {}),
    ...(snapshot.degreesAwarded ? { degreesAwarded: snapshot.degreesAwarded } : {}),
    ...(snapshot.locale ? { locale: snapshot.locale } : {}),
    ...(snapshot.avgNetPriceOverall != null ? { avgNetPriceOverall: snapshot.avgNetPriceOverall } : {}),
    ...(snapshot.attendanceAcademicYear != null ? { attendanceAcademicYear: snapshot.attendanceAcademicYear } : {}),
    ...(snapshot.pellGrantRate != null ? { pellGrantRate: snapshot.pellGrantRate } : {}),
    ...(snapshot.medianDebtCompletersOverall != null
      ? { medianDebtCompletersOverall: snapshot.medianDebtCompletersOverall }
      : {}),
  };
}

function snapshotsEqual(left: College, right: College) {
  return JSON.stringify(toSavedCollegeSnapshot(left)) === JSON.stringify(toSavedCollegeSnapshot(right));
}

class SavedCollegesService {
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

  async getUserSavedColleges(uid: string): Promise<College[]> {
    if (!db || !uid) return [];

    const snapshot = await getDocs(collection(db, "users", uid, SAVED_COLLEGES_SUBCOLLECTION));
    return snapshot.docs.map((savedDoc) =>
      fromSavedCollegeSnapshot(savedDoc.id, savedDoc.data() as Partial<SavedCollegeSnapshot>)
    );
  }

  async saveCollege(uid: string, college: College): Promise<void> {
    if (!db || !uid) return;

    const ref = doc(db, "users", uid, SAVED_COLLEGES_SUBCOLLECTION, String(college.id));
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
    await deleteDoc(doc(db, "users", uid, SAVED_COLLEGES_SUBCOLLECTION, String(collegeId)));
  }

  async clearLegacySavedCollegesField(uid: string): Promise<void> {
    if (!db || !uid) return;
    await updateDoc(doc(db, "users", uid), {
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

  async syncSavedColleges(uid: string, localSavedColleges: College[], legacySavedCollegeIds: string[] = []): Promise<College[]> {
    if (!db || !uid) return this.mergeSavedCollegeLists([], localSavedColleges ?? []);

    const remoteSavedColleges = await this.getUserSavedColleges(uid);
    const legacySavedColleges = await this.resolveLegacySavedColleges(
      legacySavedCollegeIds,
      this.mergeSavedCollegeLists(remoteSavedColleges, localSavedColleges ?? [])
    );
    const merged = this.mergeSavedCollegeLists(
      this.mergeSavedCollegeLists(remoteSavedColleges, legacySavedColleges),
      localSavedColleges ?? []
    );

    const remoteById = new Map(remoteSavedColleges.map((college) => [String(college.id), college]));
    const toUpload = merged.filter((college) => {
      const remote = remoteById.get(String(college.id));
      return !remote || !snapshotsEqual(remote, college);
    });

    if (toUpload.length > 0) {
      await Promise.all(toUpload.map((college) => this.saveCollege(uid, college)));
    }

    if (legacySavedCollegeIds.length > 0) {
      await this.clearLegacySavedCollegesField(uid);
    }

    return merged;
  }
}

export const savedCollegesService = new SavedCollegesService();
