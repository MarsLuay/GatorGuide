// services/college.service.ts
// College matching and data service
// Currently returns stub data, will connect to College Scorecard API later

import AsyncStorage from '@react-native-async-storage/async-storage';
import { addDoc, collection, serverTimestamp, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { API_CONFIG, isStubMode } from './config';
import { db } from './firebase';
import { firebaseAuth } from './firebase';

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
  tuition: number;
  size: 'small' | 'medium' | 'large';
  setting: 'urban' | 'suburban' | 'rural';
  admissionRate: number;
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
        { id: '1', name: 'University of Washington', location: { city: 'Seattle', state: 'WA' }, tuition: 12076, size: 'large', setting: 'urban', admissionRate: 0.53, programs: ['Computer Science', 'Engineering', 'Business'], matchScore: 92 },
        { id: '2', name: 'Washington State University', location: { city: 'Pullman', state: 'WA' }, tuition: 12701, size: 'large', setting: 'rural', admissionRate: 0.86, programs: ['Business', 'Engineering', 'Agriculture'], matchScore: 88 },
        { id: '3', name: 'Western Washington University', location: { city: 'Bellingham', state: 'WA' }, tuition: 9456, size: 'medium', setting: 'suburban', admissionRate: 0.93, programs: ['Education', 'Environmental Science', 'Business'], matchScore: 85 },
        { id: '4', name: 'University of Florida', location: { city: 'Gainesville', state: 'FL' }, tuition: 28659, size: 'large', setting: 'suburban', admissionRate: 0.23, programs: ['Computer Science', 'Engineering'], matchScore: 95 },
        { id: '5', name: 'Evergreen State College', location: { city: 'Olympia', state: 'WA' }, tuition: 10232, size: 'small', setting: 'suburban', admissionRate: 0.97, programs: ['Liberal Arts', 'Environmental Studies'], matchScore: 80 },
      ];
    }

    const cacheKey = getCacheKey('matches', JSON.stringify(criteria));
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
      'latest.cost.tuition.in_state',
      'latest.cost.tuition.out_of_state',
      'latest.student.size',
      'school.degrees_awarded.predominant',
    ].join(',');

    const params = new URLSearchParams({
      api_key: API_CONFIG.collegeScorecard.apiKey,
      fields,
      per_page: '10',
    });

    if (criteria.location) params.set('school.state', criteria.location);
    if (criteria.major) params.set('school.programs.cip_4_digit', criteria.major);

    try {
      const res = await fetch(`${API_CONFIG.collegeScorecard.baseUrl}/schools?${params.toString()}`);
      if (!res.ok) throw new Error('College Scorecard API request failed');
      const data = await res.json();

      const results = (data?.results ?? []).map((r: any, index: number) => {
        const sizeVal = r?.latest?.student?.size ?? 0;
        const size: College['size'] = sizeVal > 15000 ? 'large' : sizeVal > 5000 ? 'medium' : 'small';
        const tuition = r?.latest?.cost?.tuition?.in_state ?? r?.latest?.cost?.tuition?.out_of_state ?? 0;

        return {
          id: String(r?.id ?? index),
          name: r?.school?.name ?? 'Unknown College',
          location: {
            city: r?.school?.city ?? '',
            state: r?.school?.state ?? '',
          },
          tuition,
          size,
          setting: 'suburban',
          admissionRate: r?.latest?.admissions?.admission_rate?.overall ?? 0,
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
      'latest.admissions.admission_rate.overall',
      'latest.cost.tuition.in_state',
      'latest.cost.tuition.out_of_state',
      'latest.student.size',
    ].join(',');

    const params = new URLSearchParams({
      api_key: API_CONFIG.collegeScorecard.apiKey,
      fields,
      id: collegeId,
    });

    try {
      const res = await fetch(`${API_CONFIG.collegeScorecard.baseUrl}/schools?${params.toString()}`);
      if (!res.ok) throw new Error('College Scorecard API request failed');
      const data = await res.json();
      const r = data?.results?.[0];

      if (!r) throw new Error('College not found');

      const sizeVal = r?.latest?.student?.size ?? 0;
      const size: College['size'] = sizeVal > 15000 ? 'large' : sizeVal > 5000 ? 'medium' : 'small';
      const tuition = r?.latest?.cost?.tuition?.in_state ?? r?.latest?.cost?.tuition?.out_of_state ?? 0;

      const result: College = {
        id: String(r?.id ?? collegeId),
        name: r?.school?.name ?? 'Unknown College',
        location: {
          city: r?.school?.city ?? '',
          state: r?.school?.state ?? '',
        },
        tuition,
        size,
        setting: 'suburban',
        admissionRate: r?.latest?.admissions?.admission_rate?.overall ?? 0,
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
    if (isStubMode() || API_CONFIG.collegeScorecard.apiKey === 'STUB') {
      this.lastSource = 'stub';
      await new Promise((resolve) => setTimeout(resolve, 300));

      const allColleges = await this.getMatches({});
      return allColleges.filter((c) =>
        c.name.toLowerCase().includes(query.toLowerCase())
      );
    }

    const cacheKey = getCacheKey('search', query);
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
      'latest.cost.tuition.in_state',
      'latest.cost.tuition.out_of_state',
      'latest.student.size',
    ].join(',');

    const params = new URLSearchParams({
      api_key: API_CONFIG.collegeScorecard.apiKey,
      fields,
      per_page: '10',
      'school.name': query,
    });

    try {
      const res = await fetch(`${API_CONFIG.collegeScorecard.baseUrl}/schools?${params.toString()}`);
      if (!res.ok) throw new Error('College Scorecard API request failed');
      const data = await res.json();

      const results = (data?.results ?? []).map((r: any, index: number) => {
        const sizeVal = r?.latest?.student?.size ?? 0;
        const size: College['size'] = sizeVal > 15000 ? 'large' : sizeVal > 5000 ? 'medium' : 'small';
        const tuition = r?.latest?.cost?.tuition?.in_state ?? r?.latest?.cost?.tuition?.out_of_state ?? 0;

        return {
          id: String(r?.id ?? index),
          name: r?.school?.name ?? 'Unknown College',
          location: {
            city: r?.school?.city ?? '',
            state: r?.school?.state ?? '',
          },
          tuition,
          size,
          setting: 'suburban',
          admissionRate: r?.latest?.admissions?.admission_rate?.overall ?? 0,
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