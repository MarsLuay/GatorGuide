// services/college.service.ts
// College matching and data service
// Currently returns stub data, will connect to College Scorecard API later

import AsyncStorage from '@react-native-async-storage/async-storage';
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  FIRESTORE_COLLECTIONS,
  FIRESTORE_USER_SUBCOLLECTIONS,
} from '@/constants/schema';
import { hasCollegeScorecardApiKey, isStubMode } from './config';
import { errorLoggingService } from './error-logging.service';
import { db } from './firebase';
import { firebaseAuth } from './firebase';
import { buildScorecardUrl, fetchScorecardUrl } from './scorecard';
import { normalizeRateValue } from '@/utils/locale-format';

const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours
const ZIP_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 3; // 3 days for ZIP geocode cache
const CACHE_VERSION = 'v4';
const COLLEGE_CACHE_PREFIX = 'college:';
const CACHE_CLEANUP_MARKER_KEY = 'college:cache:cleanup:version';

const getCacheKey = (type: 'matches' | 'search' | 'details', payload: string) =>
  `college:${CACHE_VERSION}:${type}:${payload}`;

const getCollegeScorecardSetupError = () =>
  new Error(
    'College Scorecard API key is missing or invalid. Update EXPO_PUBLIC_COLLEGE_SCORECARD_KEY in Mobile Team/.env with a valid api.data.gov key, then restart Expo.'
  );

const readCache = async (key: string): Promise<College[] | College | null> => {
  // Shared TTL check for list/detail/search cache entries.
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { timestamp: number; data: College[] | College };
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) return null;
    return Array.isArray(parsed.data)
      ? parsed.data.map((college) => normalizeCollegeRates(college))
      : normalizeCollegeRates(parsed.data);
  } catch {
    return null;
  }
};

const writeCache = async (key: string, data: College[] | College) => {
  const payload = JSON.stringify({ timestamp: Date.now(), data });
  await AsyncStorage.setItem(key, payload);
};

let legacyCollegeCacheCleanupPromise: Promise<void> | null = null;

const removeLegacyCollegeCaches = async () => {
  try {
    const lastCleanupVersion = await AsyncStorage.getItem(CACHE_CLEANUP_MARKER_KEY);
    if (lastCleanupVersion === CACHE_VERSION) return;

    const keys = await AsyncStorage.getAllKeys();
    const legacyKeys = keys.filter(
      (key) =>
        key.startsWith(COLLEGE_CACHE_PREFIX) &&
        key !== CACHE_CLEANUP_MARKER_KEY &&
        !key.startsWith(`${COLLEGE_CACHE_PREFIX}${CACHE_VERSION}:`)
    );

    if (legacyKeys.length > 0) {
      await AsyncStorage.multiRemove(legacyKeys);
    }

    await AsyncStorage.setItem(CACHE_CLEANUP_MARKER_KEY, CACHE_VERSION);
  } catch {
    // Best-effort cleanup only; stale cache keys should never block college data reads.
  }
};

const ensureLegacyCollegeCacheCleanup = async () => {
  if (!legacyCollegeCacheCleanupPromise) {
    legacyCollegeCacheCleanupPromise = removeLegacyCollegeCaches().finally(() => {
      legacyCollegeCacheCleanupPromise = null;
    });
  }

  await legacyCollegeCacheCleanupPromise;
};

const normalizeCollegeRates = <T extends College>(college: T): T => ({
  ...college,
  admissionRate: normalizeRateValue(college.admissionRate),
  completionRate: normalizeRateValue(college.completionRate),
  pellGrantRate: normalizeRateValue(college.pellGrantRate),
});

export type College = {
  id: string;
  name: string;
  location: { city: string; state: string; };
  lat?: number | null; // Added latitude field
  lon?: number | null; // Added longitude field
  tuition: number | null;
  tuitionInState?: number | null;
  tuitionOutOfState?: number | null;
  // raw numeric student size from Scorecard (may be null)
  studentSize?: number | null;
  size: 'small' | 'medium' | 'large' | 'unknown';
  setting: 'urban' | 'suburban' | 'rural';
  admissionRate: number | null;
  completionRate?: number | null;
  website?: string | null;
  priceCalculator?: string | null;
  programs: string[];
  matchScore?: number;
  // Raw Scorecard payload for advanced views (optional)
  raw?: any;
  // Extended fields from Scorecard
  degreesAwarded?: { highest?: string | null; predominant?: string | null } | null;
  locale?: string | null;
  avgNetPriceOverall?: number | null;
  attendanceAcademicYear?: string | number | null;
  pellGrantRate?: number | null;
  medianDebtCompletersOverall?: number | null;
};
const toNumber = (v: any): number | null => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const extractProgramSignals = (scorecardResult: any): string[] => {
  const out = new Set<string>();

  const add = (v: unknown) => {
    const s = String(v ?? '').trim();
    if (!s) return;
    out.add(s);
  };

  const walk = (node: any) => {
    if (node == null) return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node !== 'object') return;
    Object.entries(node).forEach(([k, v]) => {
      const key = k.toLowerCase();
      if (key.includes('title') || key.includes('name') || key === 'code' || key.includes('cip')) {
        if (typeof v === 'string' || typeof v === 'number') add(v);
      }
      walk(v);
    });
  };

  walk(scorecardResult?.latest?.programs);
  return Array.from(out).slice(0, 80);
};

const haversineMiles = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 3958.8; // miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export type CollegeMatchCriteria = {
  major?: string;
  gpa?: string;
  testScores?: string;
  location?: string;
  budget?: string;
  size?: string;
  setting?: string;
  environment?: string;
};

class CollegeService {
  private lastSource: 'live' | 'cached' | 'stub' | null = null;

  getLastSource() {
    return this.lastSource;
  }

  /**
   * TASK: Firebase Questionnaire collection
   * Saves user survey answers to Firestore
   */
  async saveQuestionnaireResult(answers: any): Promise<string> {
    if (!db || !firebaseAuth?.currentUser) {
      throw new Error("Authentication required");
    }

    try {
      const user = firebaseAuth.currentUser;
      const docRef = doc(db, FIRESTORE_COLLECTIONS.questionnaires, user.uid);
      await setDoc(docRef, {
        userId: user.uid,
        answers,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      return docRef.id;
    } catch (error) {
      void errorLoggingService.captureException(error, {
        category: "firestore",
        operation: "save-questionnaire-result",
        severity: "error",
        handled: false,
        source: "college.service",
        metadata: {
          answerCount: Object.keys(answers ?? {}).length,
          uid: firebaseAuth?.currentUser?.uid ?? null,
        },
      });
      throw error;
    }
  }

  /**
   * Legacy helper: save/remove a minimal favorite marker.
   * The app now uses saved-colleges.service.ts to persist full college snapshots.
   */
  async toggleSavedCollege(collegeId: string, isSaved: boolean): Promise<void> {
    if (!db || !firebaseAuth?.currentUser) return;

    const user = firebaseAuth.currentUser;
    const savedCollegeRef = doc(
      db,
      FIRESTORE_COLLECTIONS.users,
      user.uid,
      FIRESTORE_USER_SUBCOLLECTIONS.savedColleges,
      String(collegeId)
    );

    if (!isSaved) {
      await deleteDoc(savedCollegeRef);
      return;
    }

    await setDoc(
      savedCollegeRef,
      {
        collegeId: String(collegeId),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  // --- Original Stub Methods (保持原样) ---
  async getMatches(criteria: CollegeMatchCriteria): Promise<College[]> {
    await ensureLegacyCollegeCacheCleanup();

    const cacheKey = getCacheKey('matches', JSON.stringify(criteria));
    const cached = await readCache(cacheKey);
    if (cached && Array.isArray(cached)) {
      this.lastSource = 'cached';
      return cached;
    }

    if (!hasCollegeScorecardApiKey()) {
      throw getCollegeScorecardSetupError();
    }
    // Request an enriched field set once so ranking and detail UI have needed data.
    const fields = [
      'id',
      'school.name',
      'school.city',
      'school.state',
      'school.school_url',
      'school.locale',
      'school.degrees_awarded.highest',
      'school.degrees_awarded.predominant',
      'latest.admissions.admission_rate.overall',
      'latest.student.size',
      'latest.cost.tuition.in_state',
      'latest.cost.tuition.out_of_state',
      'latest.cost.avg_net_price.overall',
      'latest.cost.attendance.academic_year',
      'latest.aid.pell_grant_rate',
      'latest.aid.median_debt.completers.overall',
      'latest.programs.cip_4_digit.code',
      'latest.programs.cip_4_digit.title',
      'latest.programs.cip_6_digit.code',
      'latest.programs.cip_6_digit.title',
    ].join(',');

    const params: Record<string, string> = {
      fields,
      per_page: '100',
      sort: 'latest.student.size:desc',
      all_programs_nested: 'true',
    };

    if (criteria.location) params['school.state'] = criteria.location;

    const url = buildScorecardUrl(params);

    try {
      const data = await fetchScorecardUrl(url);
      const results = (data?.results ?? []).map((r: any, index: number) => {
        const studentSize = r?.latest?.student?.size ?? null;
        const size: College['size'] = typeof studentSize === 'number' ? (studentSize > 15000 ? 'large' : studentSize > 5000 ? 'medium' : 'small') : 'unknown';
        const tuitionInState = r?.latest?.cost?.tuition?.in_state ?? null;
        const tuitionOutOfState = r?.latest?.cost?.tuition?.out_of_state ?? null;
        const tuition = tuitionInState ?? tuitionOutOfState ?? null;
        const locale = (r?.school?.locale || '').toString();
        const setting: College['setting'] = locale.toLowerCase().includes('city') ? 'urban' : locale.toLowerCase().includes('rural') ? 'rural' : 'suburban';

        return normalizeCollegeRates({
          id: String(r?.id ?? index),
          name: r?.school?.name ?? 'Unknown College',
          location: {
            city: r?.school?.city ?? '',
            state: r?.school?.state ?? '',
          },
          tuition,
          tuitionInState,
          tuitionOutOfState,
          studentSize,
          size,
          setting,
          admissionRate: r?.latest?.admissions?.admission_rate?.overall ?? null,
          completionRate: r?.latest?.completion?.rate ?? r?.latest?.completion_rate ?? null,
          website: r?.school?.school_url ?? null,
          priceCalculator: r?.school?.price_calculator_url ?? r?.school?.school_url ?? null,
          programs: extractProgramSignals(r),
          degreesAwarded: {
            highest: r?.school?.degrees_awarded?.highest ?? null,
            predominant: r?.school?.degrees_awarded?.predominant ?? null,
          },
          locale: r?.school?.locale ?? null,
          avgNetPriceOverall: r?.latest?.cost?.avg_net_price?.overall ?? null,
          attendanceAcademicYear: r?.latest?.cost?.attendance?.academic_year ?? null,
          pellGrantRate: r?.latest?.aid?.pell_grant_rate ?? null,
          medianDebtCompletersOverall: r?.latest?.aid?.median_debt?.completers?.overall ?? null,
        } as College);
      });

      await writeCache(cacheKey, results);
      this.lastSource = 'live';
      return results;
    } catch (error) {
      if (cached && Array.isArray(cached)) {
        this.lastSource = 'cached';
        return cached;
      }
      throw error;
    }
  }

  async getCollegeDetails(collegeId: string): Promise<College> {
    await ensureLegacyCollegeCacheCleanup();

    const cacheKey = getCacheKey('details', collegeId);
    const cached = await readCache(cacheKey);
    if (cached && !Array.isArray(cached)) {
      this.lastSource = 'cached';
      return cached;
    }

    if (!hasCollegeScorecardApiKey()) {
      throw getCollegeScorecardSetupError();
    }

    const fields = [
      'id',
      'school.name',
      'school.city',
      'school.state',
      'school.school_url',
      'school.locale',
      'school.degrees_awarded.highest',
      'school.degrees_awarded.predominant',
      'latest.admissions.admission_rate.overall',
      'latest.student.size',
      'latest.cost.tuition.in_state',
      'latest.cost.tuition.out_of_state',
      'latest.cost.avg_net_price.overall',
      'latest.cost.attendance.academic_year',
      'latest.aid.pell_grant_rate',
      'latest.aid.median_debt.completers.overall',
      'latest.programs.cip_4_digit.code',
      'latest.programs.cip_4_digit.title',
      'latest.programs.cip_6_digit.code',
      'latest.programs.cip_6_digit.title',
    ].join(',');

    const params: Record<string, string> = {
      fields,
      id: collegeId,
      per_page: '1',
      all_programs_nested: 'true',
    };

    const url = buildScorecardUrl(params);

    try {
      const data = await fetchScorecardUrl(url);
      const r = data?.results?.[0];
      if (!r) throw new Error('College not found');

      const studentSize = r?.latest?.student?.size ?? null;
      const size: College['size'] = typeof studentSize === 'number' ? (studentSize > 15000 ? 'large' : studentSize > 5000 ? 'medium' : 'small') : 'unknown';
      const tuitionInState = r?.latest?.cost?.tuition?.in_state ?? null;
      const tuitionOutOfState = r?.latest?.cost?.tuition?.out_of_state ?? null;
      const tuition = tuitionInState ?? tuitionOutOfState ?? null;
      const locale = (r?.school?.locale || '').toString();
      const setting: College['setting'] = locale.toLowerCase().includes('city') ? 'urban' : locale.toLowerCase().includes('rural') ? 'rural' : 'suburban';

      const result: College = normalizeCollegeRates({
        id: String(r?.id ?? collegeId),
        name: r?.school?.name ?? 'Unknown College',
        location: {
          city: r?.school?.city ?? '',
          state: r?.school?.state ?? '',
        },
        tuition,
        studentSize,
        size,
        setting,
        admissionRate: r?.latest?.admissions?.admission_rate?.overall ?? null,
        completionRate: r?.latest?.completion?.rate ?? r?.latest?.completion_rate ?? null,
        website: r?.school?.school_url ?? null,
        priceCalculator: r?.school?.price_calculator_url ?? r?.school?.school_url ?? null,
        programs: extractProgramSignals(r),
        degreesAwarded: {
          highest: r?.school?.degrees_awarded?.highest ?? null,
          predominant: r?.school?.degrees_awarded?.predominant ?? null,
        },
        locale: r?.school?.locale ?? null,
        avgNetPriceOverall: r?.latest?.cost?.avg_net_price?.overall ?? null,
        attendanceAcademicYear: r?.latest?.cost?.attendance?.academic_year ?? null,
        pellGrantRate: r?.latest?.aid?.pell_grant_rate ?? null,
        medianDebtCompletersOverall: r?.latest?.aid?.median_debt?.completers?.overall ?? null,
        // include raw full Scorecard result for advanced views (do NOT log this)
        raw: r ?? null,
      } as College);

      await writeCache(cacheKey, result);
      this.lastSource = 'live';
      return result;
    } catch (error) {
      if (cached && !Array.isArray(cached)) {
        this.lastSource = 'cached';
        return cached;
      }
      throw error;
    }
  }

  async searchColleges(query: string): Promise<College[]> {
    await ensureLegacyCollegeCacheCleanup();

    const q = query.trim();
    if (q.length < 3) {
      this.lastSource = isStubMode() ? 'stub' : 'cached';
      return [];
    }

    const cacheKey = getCacheKey('search', q);
    const cached = await readCache(cacheKey);
    if (cached && Array.isArray(cached)) {
      this.lastSource = 'cached';
      return cached;
    }

    if (isStubMode() || !hasCollegeScorecardApiKey()) {
      throw getCollegeScorecardSetupError();
    }

    const fields = [
      'id',
      'school.name',
      'school.city',
      'school.state',
      'latest.admissions.admission_rate.overall',
      'latest.student.size',
      'latest.cost.tuition.in_state',
    ].join(',');

    const params: Record<string, string> = {
      fields,
      per_page: '20',
      'school.name': q,
    };

    const url = buildScorecardUrl(params);

    try {
      const data = await fetchScorecardUrl(url);

      const results = (data?.results ?? []).map((r: any, index: number) => {
        const studentSize = r?.latest?.student?.size ?? null;
        const size: College['size'] = typeof studentSize === 'number' ? (studentSize > 15000 ? 'large' : studentSize > 5000 ? 'medium' : 'small') : 'unknown';
        const tuitionInState = r?.latest?.cost?.tuition?.in_state ?? null;
        const tuitionOutOfState = r?.latest?.cost?.tuition?.out_of_state ?? null;
        const tuition = tuitionInState ?? tuitionOutOfState ?? null;
        const locale = (r?.school?.locale || '').toString();
        const setting: College['setting'] = locale.toLowerCase().includes('city') ? 'urban' : locale.toLowerCase().includes('rural') ? 'rural' : 'suburban';

        return normalizeCollegeRates({
          id: String(r?.id ?? index),
          name: r?.school?.name ?? 'Unknown College',
          location: {
            city: r?.school?.city ?? '',
            state: r?.school?.state ?? '',
          },
          tuition,
          tuitionInState,
          tuitionOutOfState,
          studentSize,
          size,
          setting,
          admissionRate: r?.latest?.admissions?.admission_rate?.overall ?? null,
          website: r?.school?.school_url ?? null,
          programs: [],
        } as College);
      });

      await writeCache(cacheKey, results);
      this.lastSource = 'live';
      return results;
    } catch (error) {
      if (cached && Array.isArray(cached)) {
        this.lastSource = 'cached';
        return cached;
      }
      throw error;
    }
  }

  // Geocode a US ZIP code to latitude/longitude using zippopotam.us
  private async geocodeZip(zip: string): Promise<{ lat: number; lon: number } | null> {
    try {
      const z = zip.trim();
      if (!/^\d{5}(-\d{4})?$/.test(z)) return null;

      const cacheKey = `zip:geocode:${z}`;
      try {
        const raw = await AsyncStorage.getItem(cacheKey);
        if (raw) {
          const parsed = JSON.parse(raw) as { timestamp: number; lat: number; lon: number };
          if (Date.now() - parsed.timestamp <= ZIP_CACHE_TTL_MS) {
            return { lat: parsed.lat, lon: parsed.lon };
          }
        }
      } catch {
        // ignore cache read errors and continue to fetch
      }

      const res = await fetch(`https://api.zippopotam.us/us/${z}`);
      if (!res.ok) return null;
      const data = await res.json();
      const place = data?.places?.[0];
      if (!place) return null;
      const lat = toNumber(place.latitude) ?? null;
      const lon = toNumber(place.longitude) ?? null;
      if (lat == null || lon == null) return null;

      // Best-effort ZIP cache avoids repeated external geocode calls.
      try {
        await AsyncStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), lat, lon }));
      } catch {
        // ignore cache write errors
      }

      return { lat, lon };
    } catch (err) {
      return null;
    }
  }

  // Return colleges within `distanceMiles` of the provided US ZIP code.
  // Returns an array of objects with `college` and `distanceMiles`.
  async getSchoolsNearZip(zip: string, distanceMiles: number): Promise<Array<{ college: College; distanceMiles: number }>> {
    const coords = await this.geocodeZip(zip);
    if (!coords) return [];

    // Get candidate colleges (stub or live cached matches)
    let candidates: College[] = [];
    try {
      // Use matches which returns a reasonable set (stub mode returns nearby stubs with lat/lon)
      candidates = await this.getMatches({});
    } catch (err) {
      candidates = [];
    }

    const results: Array<{ college: College; distanceMiles: number }> = [];
    for (const c of candidates) {
      if (typeof c.lat !== 'number' || typeof c.lon !== 'number') continue;
      const d = haversineMiles(coords.lat, coords.lon, c.lat as number, c.lon as number);
      if (d <= distanceMiles) results.push({ college: c, distanceMiles: d });
    }

    results.sort((a, b) => a.distanceMiles - b.distanceMiles);
    return results;
  }
}

export const collegeService = new CollegeService();
