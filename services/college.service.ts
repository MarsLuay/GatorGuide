// services/college.service.ts
// College matching and data service
// Currently returns stub data, will connect to College Scorecard API later

import AsyncStorage from '@react-native-async-storage/async-storage';
import { addDoc, collection, serverTimestamp, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { API_CONFIG, isStubMode } from './config';
import { db } from './firebase';
import { firebaseAuth } from './firebase';
import { buildScorecardUrl, fetchScorecardUrl } from './scorecard';

const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours
const ZIP_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 3; // 3 days for ZIP geocode cache

const getCacheKey = (type: 'matches' | 'search' | 'details', payload: string) =>
  `college:${type}:${payload}`;

const readCache = async (key: string): Promise<College[] | College | null> => {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { timestamp: number; data: College[] | College };
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
};

const writeCache = async (key: string, data: College[] | College) => {
  const payload = JSON.stringify({ timestamp: Date.now(), data });
  await AsyncStorage.setItem(key, payload);
};

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
    if (isStubMode()) {
      console.log('[STUB] Saving questionnaire:', answers);
      return 'stub-id';
    }
    if (!db || !firebaseAuth?.currentUser) {
      throw new Error("Authentication required");
    }

    try {
      const user = firebaseAuth.currentUser;
      const docRef = await addDoc(collection(db, 'questionnaires'), {
        userId: user.uid,
        answers,
        createdAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (error) {
      console.error("Error saving questionnaire:", error);
      throw error;
    }
  }

  /**
   * TASK: Firebase Saved Colleges collection
   * Adds or removes a college from user's favorites
   */
  async toggleSavedCollege(collegeId: string, isSaved: boolean): Promise<void> {
    if (isStubMode() || !db || !firebaseAuth?.currentUser) return;

    const user = firebaseAuth.currentUser;
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, {
      savedColleges: isSaved ? arrayUnion(collegeId) : arrayRemove(collegeId),
    });
  }

  // --- Original Stub Methods (保持原样) ---
  async getMatches(criteria: CollegeMatchCriteria): Promise<College[]> {
    if (isStubMode() || API_CONFIG.collegeScorecard.apiKey === 'STUB') {
      this.lastSource = 'stub';
      await new Promise((resolve) => setTimeout(resolve, 600));
      return [
        { id: '1', name: 'University of Washington', location: { city: 'Seattle', state: 'WA' }, lat: 47.6553, lon: -122.3035, tuition: 12076, tuitionInState: 12076, tuitionOutOfState: 42000, size: 'large', setting: 'urban', admissionRate: 0.53, programs: ['Computer Science', 'Engineering', 'Business'], matchScore: 92 },
        { id: '2', name: 'Washington State University', location: { city: 'Pullman', state: 'WA' }, lat: 46.7324, lon: -117.1549, tuition: 12701, tuitionInState: 12701, tuitionOutOfState: 34000, size: 'large', setting: 'rural', admissionRate: 0.86, programs: ['Business', 'Engineering', 'Agriculture'], matchScore: 88 },
        { id: '3', name: 'Western Washington University', location: { city: 'Bellingham', state: 'WA' }, lat: 48.7363, lon: -122.4876, tuition: 9456, tuitionInState: 9456, tuitionOutOfState: 20000, size: 'medium', setting: 'suburban', admissionRate: 0.93, programs: ['Education', 'Environmental Science', 'Business'], matchScore: 85 },
        { id: '4', name: 'University of Florida', location: { city: 'Gainesville', state: 'FL' }, lat: 29.6516, lon: -82.3248, tuition: 28659, tuitionInState: 28659, tuitionOutOfState: 45000, size: 'large', setting: 'suburban', admissionRate: 0.23, programs: ['Computer Science', 'Engineering'], matchScore: 95 },
        { id: '5', name: 'Evergreen State College', location: { city: 'Olympia', state: 'WA' }, lat: 47.0379, lon: -122.9007, tuition: 10232, tuitionInState: 10232, tuitionOutOfState: 25000, size: 'small', setting: 'suburban', admissionRate: 0.97, programs: ['Liberal Arts', 'Environmental Studies'], matchScore: 80 },
      ];
    }

    const cacheKey = getCacheKey('matches', JSON.stringify(criteria));
    const cached = await readCache(cacheKey);
    if (cached && Array.isArray(cached)) {
      this.lastSource = 'cached';
      return cached;
    }
    // Build fields and params for Scorecard
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
    ].join(',');

    const params: Record<string, string> = {
      fields,
      per_page: '20',
      sort: 'latest.student.size:desc',
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

        return {
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
        } as College;
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
    if (isStubMode() || API_CONFIG.collegeScorecard.apiKey === 'STUB') {
      this.lastSource = 'stub';
      await new Promise((resolve) => setTimeout(resolve, 500));

      return {
        id: collegeId,
        name: 'University of Florida',
        location: { city: 'Gainesville', state: 'FL' },
        tuition: 28659,
        tuitionInState: 28659,
        tuitionOutOfState: 45000,
        size: 'large',
        setting: 'suburban',
        admissionRate: 0.23,
        programs: ['Computer Science', 'Engineering', 'Business', 'Medicine', 'Law'],
        degreesAwarded: { highest: 'four or more years', predominant: 'bachelors' },
        locale: 'City: Large',
        avgNetPriceOverall: 12000,
        attendanceAcademicYear: 2022,
        pellGrantRate: 0.34,
        medianDebtCompletersOverall: 15000,
        raw: {
          stub: true,
          id: collegeId,
          school: {
            name: 'University of Florida',
            city: 'Gainesville',
            state: 'FL',
            locale: 'City: Large',
            degrees_awarded: { highest: 'four or more years', predominant: 'bachelors' },
            school_url: 'https://www.ufl.edu',
          },
          latest: {
            cost: { avg_net_price: { overall: 12000 }, attendance: { academic_year: 2022 }, tuition: { in_state: 28659, out_of_state: 45000 } },
            aid: { pell_grant_rate: 0.34, median_debt: { completers: { overall: 15000 } } },
            admissions: { admission_rate: { overall: 0.23 } },
            student: { size: 40000 }
          }
        },
      };
    }

    const cacheKey = getCacheKey('details', collegeId);
    const cached = await readCache(cacheKey);
    if (cached && !Array.isArray(cached)) {
      this.lastSource = 'cached';
      return cached;
    }

    const fields = [
      'id',
      'school.name',
      'school.city',
      'school.state',
      'school.school_url',
      'latest.admissions.admission_rate.overall',
      'latest.student.size',
      'latest.cost.tuition.in_state',
      'latest.cost.tuition.out_of_state',
    ].join(',');

    const params: Record<string, string> = {
      fields,
      id: collegeId,
      per_page: '1',
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

      const result: College = {
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
        programs: [],
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
      } as College;

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
    const q = query.trim();
    if (q.length < 3) {
      this.lastSource = isStubMode() ? 'stub' : 'cached';
      return [];
    }

    if (isStubMode() || API_CONFIG.collegeScorecard.apiKey === 'STUB') {
      this.lastSource = 'stub';
      await new Promise((resolve) => setTimeout(resolve, 300));

      const allColleges = await this.getMatches({});
      return allColleges.filter((c) =>
        c.name.toLowerCase().includes(q.toLowerCase())
      );
    }

    const cacheKey = getCacheKey('search', q);
    const cached = await readCache(cacheKey);
    if (cached && Array.isArray(cached)) {
      this.lastSource = 'cached';
      return cached;
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

        return {
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
        } as College;
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

      // write cache (best-effort)
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