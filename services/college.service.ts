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
        { id: '1', name: 'University of Washington', location: { city: 'Seattle', state: 'WA' }, tuition: 12076, tuitionInState: 12076, tuitionOutOfState: 42000, size: 'large', setting: 'urban', admissionRate: 0.53, programs: ['Computer Science', 'Engineering', 'Business'], matchScore: 92 },
        { id: '2', name: 'Washington State University', location: { city: 'Pullman', state: 'WA' }, tuition: 12701, tuitionInState: 12701, tuitionOutOfState: 34000, size: 'large', setting: 'rural', admissionRate: 0.86, programs: ['Business', 'Engineering', 'Agriculture'], matchScore: 88 },
        { id: '3', name: 'Western Washington University', location: { city: 'Bellingham', state: 'WA' }, tuition: 9456, tuitionInState: 9456, tuitionOutOfState: 20000, size: 'medium', setting: 'suburban', admissionRate: 0.93, programs: ['Education', 'Environmental Science', 'Business'], matchScore: 85 },
        { id: '4', name: 'University of Florida', location: { city: 'Gainesville', state: 'FL' }, tuition: 28659, tuitionInState: 28659, tuitionOutOfState: 45000, size: 'large', setting: 'suburban', admissionRate: 0.23, programs: ['Computer Science', 'Engineering'], matchScore: 95 },
        { id: '5', name: 'Evergreen State College', location: { city: 'Olympia', state: 'WA' }, tuition: 10232, tuitionInState: 10232, tuitionOutOfState: 25000, size: 'small', setting: 'suburban', admissionRate: 0.97, programs: ['Liberal Arts', 'Environmental Studies'], matchScore: 80 },
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
      'latest.admissions.admission_rate.overall',
      'latest.student.size',
      'latest.cost.tuition.in_state',
      'latest.cost.tuition.out_of_state',
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
}

export const collegeService = new CollegeService();