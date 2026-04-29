// services/college.service.ts
// College matching and data service
// Currently returns stub data, will connect to College Scorecard API later

import AsyncStorage from '@react-native-async-storage/async-storage';
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  FIRESTORE_COLLECTIONS,
  FIRESTORE_USER_SUBCOLLECTIONS,
} from '@/constants/schema';
import { COLLEGE_SCORECARD_CIP4_PROGRAMS } from '@/constants/college-scorecard-cip4';
import { hasCollegeScorecardApiKey, isStubMode } from '@/services/app/config';
import { errorLoggingService } from '@/services/logging/error-logging.service';
import { db, firebaseAuth } from '@/services/firebase/firebase';
import { buildScorecardUrl, fetchScorecardUrl } from './scorecard';
import { normalizeRateValue } from '@/utils/locale-format';

const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours
const ZIP_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 3; // 3 days for ZIP geocode cache
const CACHE_VERSION = 'v5';
const COLLEGE_CACHE_PREFIX = 'college:';
const CACHE_CLEANUP_MARKER_KEY = 'college:cache:cleanup:version';
const SCORECARD_PAGE_SIZE = 100;
const SCORECARD_PAGE_BATCH_SIZE = 4;
const SCORECARD_ENRICHED_FIELDS = [
  'id',
  'school.name',
  'school.city',
  'school.state',
  'school.school_url',
  'school.price_calculator_url',
  'school.locale',
  'school.degrees_awarded.highest',
  'school.degrees_awarded.predominant',
  'latest.admissions.admission_rate.overall',
  'latest.student.size',
  'latest.completion.rate',
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
const LOCAL_ONLY_QUESTIONNAIRE_KEYS = new Set([
  'completedCourses',
  'transferPlannerCompletedCourses',
  'transferPlannerTranscriptSource',
  'transferPlannerTranscriptUploadedAt',
  'transferPlannerTranscriptParserVersion',
]);

const getCacheKey = (type: 'matches' | 'search' | 'details', payload: string) =>
  `college:${CACHE_VERSION}:${type}:${payload}`;

const getCollegeScorecardSetupError = () =>
  new Error(
    'College Scorecard API key is missing or invalid. Update EXPO_PUBLIC_COLLEGE_SCORECARD_KEY in source/.env with a valid api.data.gov key, then restart Expo.'
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

const sanitizeQuestionnaireAnswersForFirestore = (answers: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(answers ?? {}).filter(([key]) => !LOCAL_ONLY_QUESTIONNAIRE_KEYS.has(key))
  );

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

const normalizeSearchText = (value: unknown) =>
  String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const tokenizeSearchText = (value: unknown) =>
  Array.from(new Set(normalizeSearchText(value).split(/\s+/).filter(Boolean)));

const isDisplayProgramTitle = (value: unknown) => {
  const raw = String(value ?? '').trim();
  return raw.length > 0 && /[a-z]/i.test(raw) && !/^\d{4,6}$/.test(raw);
};

const getProgramEntries = (programs: any, key: 'cip_4_digit' | 'cip_6_digit') => {
  const entries = programs?.[key];
  if (!entries) return [] as any[];
  return Array.isArray(entries) ? entries : [entries];
};

const extractProgramSignals = (scorecardResult: any): string[] => {
  const out = new Set<string>();

  const add = (v: unknown) => {
    const s = String(v ?? '').trim();
    if (!s) return;
    out.add(s);
  };

  const collectPrograms = (programs: any) => {
    for (const key of ['cip_4_digit', 'cip_6_digit'] as const) {
      for (const entry of getProgramEntries(programs, key)) {
        add(entry?.title);
        add(entry?.code);
      }
    }
  };

  collectPrograms(scorecardResult?.latest?.programs);
  collectPrograms(scorecardResult?.programs);
  return Array.from(out).slice(0, 80);
};

const scoreProgramTitleMatch = (query: string, title: string) => {
  const normalizedQuery = normalizeSearchText(query);
  const normalizedTitle = normalizeSearchText(title);
  if (!normalizedQuery || !normalizedTitle) return 0;

  if (normalizedTitle === normalizedQuery) return 150;
  if (normalizedTitle.startsWith(`${normalizedQuery} `) || normalizedTitle.startsWith(normalizedQuery))
    return 125;
  if (normalizedTitle.includes(normalizedQuery)) return 105;

  const queryTokens = tokenizeSearchText(normalizedQuery);
  const titleTokens = tokenizeSearchText(normalizedTitle);
  if (!queryTokens.length || !titleTokens.length) return 0;

  const exactTokenHits = queryTokens.filter((token) => titleTokens.includes(token)).length;
  if (exactTokenHits === queryTokens.length) {
    return 90 - Math.max(0, titleTokens.length - queryTokens.length) * 3;
  }

  if (exactTokenHits === 0) return 0;
  return Math.round((exactTokenHits / queryTokens.length) * 70);
};

const findMatchingCip4Programs = (query: string) => {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return [] as { code: string; title: string; score: number }[];

  const queryAllowsGeneral = /\b(general|other|misc|miscellaneous)\b/.test(normalizedQuery);
  const queryAllowsResidency = /\b(residency|fellowship)\b/.test(normalizedQuery);

  const matches = COLLEGE_SCORECARD_CIP4_PROGRAMS
    .map((program) => {
      const normalizedTitle = normalizeSearchText(program.title);
      let score = scoreProgramTitleMatch(normalizedQuery, program.title);
      if (!score) return null;

      if (!queryAllowsGeneral && /\b(general|other|misc|miscellaneous)\b/.test(normalizedTitle)) {
        score -= 15;
      }
      if (!queryAllowsResidency && /\b(residency|fellowship)\b/.test(normalizedTitle)) {
        score -= 25;
      }

      return score >= 70 ? { ...program, score } : null;
    })
    .filter((program): program is { code: string; title: string; score: number } => !!program)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

  const topScore = matches[0]?.score ?? 0;
  return matches.filter((program) => program.score >= Math.max(90, topScore - 6));
};

const mapScorecardSchoolResult = (r: any, index: number): College => {
  const studentSize = r?.latest?.student?.size ?? null;
  const size: College['size'] =
    typeof studentSize === 'number'
      ? studentSize > 15000
        ? 'large'
        : studentSize > 5000
          ? 'medium'
          : 'small'
      : 'unknown';
  const tuitionInState = r?.latest?.cost?.tuition?.in_state ?? null;
  const tuitionOutOfState = r?.latest?.cost?.tuition?.out_of_state ?? null;
  const tuition = tuitionInState ?? tuitionOutOfState ?? null;
  const locale = String(r?.school?.locale ?? '');
  const normalizedLocale = locale.toLowerCase();
  const setting: College['setting'] = normalizedLocale.includes('city')
    ? 'urban'
    : normalizedLocale.includes('rural')
      ? 'rural'
      : 'suburban';

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
};

const getCollegeSearchScore = (college: College, query: string) => {
  const normalizedQuery = normalizeSearchText(query);
  const name = normalizeSearchText(college.name);
  const tokens = tokenizeSearchText(normalizedQuery);
  const programs = (college.programs ?? [])
    .filter(isDisplayProgramTitle)
    .map((program) => String(program ?? '').trim());
  const bestProgramScore = programs.reduce(
    (best, program) => Math.max(best, scoreProgramTitleMatch(normalizedQuery, program)),
    0
  );

  let score = bestProgramScore * 3;
  if (name === normalizedQuery) score += 500;
  else if (name.startsWith(normalizedQuery)) score += 350;
  else if (name.includes(normalizedQuery)) score += 240;
  else if (tokens.length > 1 && tokens.every((token) => name.includes(token))) score += 180;
  else if (tokens.some((token) => name.includes(token))) score += 90;

  return score;
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

  private async fetchSchoolsByParams(
    params: Record<string, string>,
    cacheKey: string
  ): Promise<{ colleges: College[]; source: 'live' | 'cached' }> {
    const cached = await readCache(cacheKey);
    if (cached && Array.isArray(cached)) {
      return { colleges: cached, source: 'cached' };
    }

    const baseParams: Record<string, string> = {
      ...params,
      fields: SCORECARD_ENRICHED_FIELDS,
      per_page: String(SCORECARD_PAGE_SIZE),
      all_programs_nested: 'true',
    };

    const firstPage = await fetchScorecardUrl(buildScorecardUrl(baseParams));
    const rawResults = Array.isArray(firstPage?.results) ? [...firstPage.results] : [];
    const total = Number(firstPage?.metadata?.total ?? rawResults.length);
    const totalPages = total > 0 ? Math.ceil(total / SCORECARD_PAGE_SIZE) : 1;

    for (let pageStart = 1; pageStart < totalPages; pageStart += SCORECARD_PAGE_BATCH_SIZE) {
      const pageNumbers = Array.from(
        { length: Math.min(SCORECARD_PAGE_BATCH_SIZE, totalPages - pageStart) },
        (_, offset) => pageStart + offset
      );
      const pageResponses = await Promise.all(
        pageNumbers.map((page) =>
          fetchScorecardUrl(
            buildScorecardUrl({
              ...baseParams,
              page: String(page),
            })
          )
        )
      );

      for (const pageResponse of pageResponses) {
        rawResults.push(...(Array.isArray(pageResponse?.results) ? pageResponse.results : []));
      }
    }

    const colleges = rawResults.map((result: any, index: number) =>
      mapScorecardSchoolResult(result, index)
    );
    await writeCache(cacheKey, colleges);
    return { colleges, source: 'live' };
  }

  private async searchSchoolsByName(query: string) {
    return this.fetchSchoolsByParams(
      {
        'school.name': query,
        sort: 'school.name:asc',
      },
      getCacheKey('search', `name:${normalizeSearchText(query)}`)
    );
  }

  private async searchSchoolsByProgramCode(code: string) {
    return this.fetchSchoolsByParams(
      {
        'programs.cip_4_digit.code': code,
        sort: 'school.name:asc',
      },
      getCacheKey('search', `cip4:${code}`)
    );
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
      const sanitizedAnswers = sanitizeQuestionnaireAnswersForFirestore(answers ?? {});
      await setDoc(docRef, {
        userId: user.uid,
        answers: sanitizedAnswers,
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
    const params: Record<string, string> = {
      fields: SCORECARD_ENRICHED_FIELDS,
      per_page: '100',
      sort: 'latest.student.size:desc',
      all_programs_nested: 'true',
    };

    if (criteria.location) params['school.state'] = criteria.location;

    const url = buildScorecardUrl(params);

    try {
      const data = await fetchScorecardUrl(url);
      const results = (data?.results ?? []).map((r: any, index: number) =>
        mapScorecardSchoolResult(r, index)
      );

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

    const params: Record<string, string> = {
      fields: SCORECARD_ENRICHED_FIELDS,
      id: collegeId,
      per_page: '1',
      all_programs_nested: 'true',
    };

    const url = buildScorecardUrl(params);

    try {
      const data = await fetchScorecardUrl(url);
      const r = data?.results?.[0];
      if (!r) throw new Error('College not found');

      const result: College = {
        ...mapScorecardSchoolResult(r, 0),
        id: String(r?.id ?? collegeId),
        raw: r ?? null,
      };

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
    if (q.length < 2) {
      this.lastSource = isStubMode() ? 'stub' : 'cached';
      return [];
    }

    const normalizedQuery = normalizeSearchText(q);
    const cacheKey = getCacheKey('search', normalizedQuery);
    const cached = await readCache(cacheKey);
    if (cached && Array.isArray(cached)) {
      this.lastSource = 'cached';
      return cached;
    }

    if (isStubMode() || !hasCollegeScorecardApiKey()) {
      throw getCollegeScorecardSetupError();
    }

    try {
      const matchedPrograms = findMatchingCip4Programs(q);
      const searches = await Promise.all([
        this.searchSchoolsByName(q),
        ...matchedPrograms.map((program) => this.searchSchoolsByProgramCode(program.code)),
      ]);

      const merged = new Map<string, College>();
      for (const search of searches) {
        for (const college of search.colleges) {
          if (!merged.has(college.id)) {
            merged.set(college.id, college);
          }
        }
      }

      const results = Array.from(merged.values()).sort((a, b) => {
        const scoreDiff = getCollegeSearchScore(b, q) - getCollegeSearchScore(a, q);
        if (scoreDiff !== 0) return scoreDiff;
        return a.name.localeCompare(b.name);
      });

      await writeCache(cacheKey, results);
      this.lastSource = searches.some((search) => search.source === 'live') ? 'live' : 'cached';
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
