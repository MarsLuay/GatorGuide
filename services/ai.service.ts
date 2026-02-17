// services/ai.service.ts
// AI chat assistant service (Gemini API)
// Currently returns stub responses, will connect to Firebase Function + Gemini later

import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG, isStubMode } from './config';
import { collegeService, College } from './college.service';

// Minimal typed shapes to improve safety in this service
export type UserProfile = {
  major?: string;
  gpa?: number | string;
  state?: string;
  [key: string]: any;
};

export type Questionnaire = {
  budget?: string;
  geography?: string;
  inStateOutOfState?: string;
  locationPreferences?: string;
  ranking?: string;
  location?: string;
  sizePreference?: string;
  settingPreference?: string;
  [key: string]: any;
};

// Minimal Gemini response shape used by this service
type GeminiCandidatePart = { text?: string };
type GeminiCandidateContent = { parts?: GeminiCandidatePart[] };
type GeminiCandidate = { content?: GeminiCandidateContent };
type GeminiResponse = { candidates?: GeminiCandidate[] } | any;

export type RecommendResult = {
  college: College;
  reason?: string;
  breakdown?: Record<string, number>;
  score?: number;
  breakdownHuman?: Record<string, string>;
  scoreText?: string;
};

export type EmptyStateCode =
  | 'IN_STATE_STATE_MISSING'
  | 'IN_STATE_NO_MATCHES'
  | 'NO_RESULTS'
  | 'QUERY_NO_RESULTS'
  | 'LLM_NO_RESOLVABLE'
  | 'NETWORK_TIMEOUT'
  | 'UPSTREAM_ERROR';

export type EmptyState = {
  code: EmptyStateCode;
  title: string;
  message: string;
};

export type RecommendResponse = {
  results: RecommendResult[];
  emptyState?: EmptyState;
};

const AI_LAST_RESPONSE_KEY = 'ai:lastResponse';
const AI_LAST_RESPONSE_MAP_KEY = 'ai:lastResponseMap';
const AI_LAST_ROADMAP_KEY = 'ai:lastRoadmap';

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string; // ISO
  source?: 'live' | 'cached' | 'cached-stale' | 'stub';
};

class AIService {
  private readonly FETCH_TIMEOUT_MS = 15000; // 15 seconds
  /**
   * Send message to AI assistant and get response
   * STUB: Returns canned responses
   * TODO: Replace with Firebase Function that calls Gemini API
   */
  async chat(message: string, context?: string): Promise<ChatMessage> {
    if (isStubMode() || API_CONFIG.gemini.apiKey === 'STUB') {
      // Simulate thinking delay
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Return stub response based on message keywords
      let response = this.getStubResponse(message);

      return {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString(),
        source: 'stub',
      };
    }

    try {
      // helper to create a stable signature for caching
      // signature is the JSON of message+context
      // use the instance helper to keep logic consistent
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.FETCH_TIMEOUT_MS);
      try {
        const response = await fetch(
          `${API_CONFIG.gemini.baseUrl}/models/gemini-1.5-flash:generateContent?key=${API_CONFIG.gemini.apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  role: 'user',
                  parts: [{ text: context ? `${context}\n\n${message}` : message }],
                },
              ],
            }),
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error('Gemini API request failed');
        }

        const data = (await response.json()) as GeminiResponse;
        const parts = data?.candidates?.[0]?.content?.parts ?? [];
        const text = parts.map((p: any) => p?.text ?? '').join('').trim() ||
          "I'm here to help with your college journey. What would you like to know?";

        const payload: ChatMessage = {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: text,
          timestamp: new Date().toISOString(),
          source: 'live',
        };

        // cache per-request signature so we don't return unrelated cached replies
        const sig = this.makeCacheSignature(message, context);
        try {
          const raw = await AsyncStorage.getItem(AI_LAST_RESPONSE_MAP_KEY);
          const map = raw ? JSON.parse(raw) as Record<string, ChatMessage> : {};
          map[sig] = payload;
          // cap the map size to keep only the most recent N entries
          const MAX_CACHED_RESPONSES = 50;
          const entries = Object.entries(map).sort(
            (a, b) => new Date(a[1].timestamp).getTime() - new Date(b[1].timestamp).getTime()
          );
          while (entries.length > MAX_CACHED_RESPONSES) {
            const [oldKey] = entries.shift()!;
            delete map[oldKey];
          }
          await AsyncStorage.setItem(AI_LAST_RESPONSE_MAP_KEY, JSON.stringify(map));
        } catch {
          // best-effort cache; ignore errors
        }

        // keep a global last response as a fallback (marked stale if reused)
        try { await AsyncStorage.setItem(AI_LAST_RESPONSE_KEY, JSON.stringify(payload)); } catch {}
        return payload;
      } finally {
        clearTimeout(timeoutId);
      }

    } catch (error) {
      const sig = this.makeCacheSignature(message, context);
      try {
        const raw = await AsyncStorage.getItem(AI_LAST_RESPONSE_MAP_KEY);
        const map = raw ? JSON.parse(raw) as Record<string, ChatMessage> : {};
        const cached = map && map[sig];
        if (cached) return { ...cached, id: `msg-${Date.now()}`, source: 'cached' };
      } catch {}

      try {
        const rawLast = await AsyncStorage.getItem(AI_LAST_RESPONSE_KEY);
        if (rawLast) {
          const parsed = JSON.parse(rawLast) as ChatMessage;
          return { ...parsed, id: `msg-${Date.now()}`, source: 'cached-stale', content: `[Stale cached response — may not match your new question]\n\n${parsed.content}` };
        }
      } catch {}

      throw error;
    }
  }

  // thin wrapper so tests and other methods can compute the same cache signature
  private makeCacheSignature(message: string, context?: string) {
    return JSON.stringify({ message: message ?? '', context: context ?? '' });
  }

  /**
   * Build preference weights from user profile and questionnaire.
   * Returns values in range 0-100 for each preference dimension.
   */
  buildPreferenceWeights(userProfile?: UserProfile | null, questionnaire?: Questionnaire | null, query?: string) {
    // Default to Transfer-Optimized weights (assume all users are transfers)
    const weights: Record<string, number> = {
      academics: 45,
      cost: 25,
      location: 15,
      prestige: 5,
      size: 5,
      setting: 5,
      aid: 0,
      debt: 0,
      aiFit: 0,
    };

    try {
      // If student indicates budget concerns in questionnaire, boost cost/aid
      const budget = questionnaire?.budget?.toString?.().toLowerCase?.() ?? '';
      if (budget === 'low' || budget === 'tight') {
        weights.cost += 20; weights.aid += 10; weights.debt += 5; weights.academics -= 15;
      } else if (budget === 'medium') {
        weights.cost += 5;
      }

      // If user provided a specific search query, give AI search fit some weight
      if (query && typeof query === 'string' && query.trim().length > 2) {
        weights.aiFit = 20;
        // reduce academics/cost to balance (they will be normalized later)
        weights.academics = Math.max(0, weights.academics - 10);
        weights.cost = Math.max(0, weights.cost - 10);
      }

      // Geography preference: in-state / out-of-state / no preference
      try {
        const geoRaw = questionnaire?.inStateOutOfState ?? questionnaire?.geography ?? questionnaire?.locationPreferences;
        if (typeof geoRaw === 'string') {
          const v = geoRaw.toString().toLowerCase().replace(/[-_]/g, ' ');
          if (v.includes('in state')) {
            // Strongly prefer in-state
            weights.location += 20;
          } else if (v.includes('out of state')) {
            // Slight preference for location still (user cares about geography)
            weights.location += 5;
          } else if (v.includes('no') && v.includes('preference')) {
            // no change
          }
        }
      } catch {
        // ignore
      }

      // Major importance: if user has a declared major, prioritize academics
      if (userProfile?.major) {
        weights.academics += 15;
      }

      // Ranking importance: if the user marked ranking as important, boost academics
      try {
        const rankRaw = questionnaire?.ranking;
        let rankKey = '';
        if (typeof rankRaw === 'string') {
          if (rankRaw.startsWith('questionnaire.')) rankKey = rankRaw.replace(/^questionnaire\./, '').toLowerCase();
          else rankKey = rankRaw.toLowerCase();
        }
        if (rankKey.includes('very') || rankKey.includes('veryimportant') || rankKey.includes('very important')) {
          weights.academics += 20;
        } else if (rankKey.includes('somewhat') || rankKey.includes('somewhatimportant') || rankKey.includes('somewhat important')) {
          weights.academics += 10;
        }
      } catch {
        // ignore
      }

      // If user provided essays / personal statements in questionnaire, slightly boost academics/fit
      if (questionnaire && Object.values(questionnaire).some((v: any) => typeof v === 'string' && v.length > 80)) {
        weights.academics += 5;
      }

      // Already using transfer-optimized defaults; no detection needed.

      // Normalize to sum 100 without rounding drift: distribute integers and
      // assign the remainder to the last key.
      const keys = Object.keys(weights);
      const total = keys.reduce((s, k) => s + (weights[k] ?? 0), 0);
      if (total <= 0) {
        // fallback: equal distribution
        const per = Math.floor(100 / keys.length);
        let running = 0;
        keys.slice(0, -1).forEach((k) => { weights[k] = per; running += per; });
        weights[keys[keys.length - 1]] = Math.max(0, 100 - running);
      } else {
        let running = 0;
        keys.slice(0, -1).forEach((k) => {
          const v = Math.floor(((weights[k] ?? 0) / total) * 100);
          weights[k] = v;
          running += v;
        });
        weights[keys[keys.length - 1]] = Math.max(0, 100 - running);
      }
    } catch {
      // ignore, return defaults
    }

    return weights;
  }

  /**
   * Simple heuristic scoring of a college against preference weights.
   * Returns a score 0-100 where higher is better.
   */
  scoreCollegeAgainstPreferences(college: College, weights: Record<string, number>, userProfile?: UserProfile | null, questionnaire?: Questionnaire | null) {
    const breakdown = this.computePreferenceBreakdown(college, weights, userProfile, questionnaire);
    return breakdown.final;
  }

  /**
   * Compute per-dimension breakdown and final score. Returns object with each dimension and final.
   */
  computePreferenceBreakdown(college: College, weights: Record<string, number>, userProfile?: UserProfile | null, questionnaire?: Questionnaire | null, aiFitScore?: number) {
    const breakdown: Record<string, number> = {};

    const major = (userProfile?.major || '').toString().toLowerCase();

    // If caller didn't supply an aiFitScore but the aiFit weight is non-zero,
    // provide a conservative default so the weighted final doesn't silently
    // drop that dimension to zero (which would penalize scores).
    try {
      const aiWeight = weights?.aiFit ?? 0;
      if (aiWeight > 0 && (aiFitScore === undefined || Number.isNaN(aiFitScore))) {
        aiFitScore = 50; // neutral default
      }
    } catch {
      // ignore and continue; fallback handled below
    }

    // academics
    let acad = 50;
    if (major && (college.programs || []).some((p) => p.toLowerCase().includes(major))) acad += 30;
    // NOTE: admission rate is intentionally NOT added into `academics` to avoid
    // double-counting selectivity. Admissions selectivity is handled in the
    // `prestige` dimension.
    // GPA contribution
    try {
      const userGpa = parseFloat(String(userProfile?.gpa ?? ''));
      if (!Number.isNaN(userGpa) && userGpa > 0) {
        const gpaNorm = Math.min(4, Math.max(0, userGpa)) / 4;
        acad += Math.round(gpaNorm * 20);
      }
    } catch {
      // ignore
    }
    // Transfer-optimized breakdown adjustments (apply for ALL users)
    try {
      if (major) {
        const offersMajor = Array.isArray(college.programs) && (college.programs || []).some((p) => p.toLowerCase().includes(major));
        if (!offersMajor) {
          // Mandatory major match for transfers: heavy penalty if missing
          acad -= 40;
        }
      }

      // Articulation agreement proxy: same state and public college -> bonus
      try {
        const userState = (userProfile?.state || '').toString().trim();
        const ownership = ((college as any)?.ownership || '').toString().toLowerCase();
        const isPublic = ownership.includes('public') || (college as any)?.isPublic === true;
        if (this.stateMatches(college?.location?.state, userState) && isPublic) {
          acad += 15;
        }
      } catch {}

      // Completion rate: always factor in (up to +20)
      try {
        let comp: any = (college as any)?.completionRate;
        if (typeof comp === 'number' && !Number.isNaN(comp)) {
          if (comp > 1) comp = comp / 100;
          comp = Math.min(1, Math.max(0, comp));
          acad += Math.round(comp * 20);
        }
      } catch {}
    } catch {}
    breakdown.academics = Math.round(Math.max(0, Math.min(100, acad)));

    // cost
    let costScore = 50;
    if (typeof college.tuition === 'number') {
      const t = college.tuition;
      const capped = Math.min(60000, Math.max(0, t));
      costScore = 100 - Math.round((capped / 60000) * 100);
    }
    breakdown.cost = costScore;

    // aid
    let aidScore = 50;
    const pr = this.normalizeRate(college.pellGrantRate);
    if (pr !== null) aidScore = Math.round(pr * 100);
    breakdown.aid = aidScore;

    // debt
    let debtScore = 50;
    if (typeof college.medianDebtCompletersOverall === 'number') {
      const d = Math.min(50000, Math.max(0, college.medianDebtCompletersOverall));
      debtScore = 100 - Math.round((d / 50000) * 100);
    }
    breakdown.debt = debtScore;

    // location
    let locScore = 50;
    if (questionnaire?.location && college.location?.state && this.stateMatches(college.location?.state, questionnaire.location)) locScore += 25;
    breakdown.location = locScore;

    // size
    let sizeScore = 50;
    if (questionnaire?.sizePreference && college.size) {
      if (questionnaire.sizePreference === college.size) sizeScore = 100;
    }
    breakdown.size = sizeScore;

    // setting
    let settingScore = 50;
    if (questionnaire?.settingPreference && college.setting) {
      if (questionnaire.settingPreference === college.setting) settingScore = 100;
    }
    breakdown.setting = settingScore;

    // prestige (lower admission rate => higher prestige)
    try {
      const prestige = this.computePrestige(college);
      breakdown.prestige = prestige;
    } catch {
      breakdown.prestige = 50;
    }

    // include aiFit if provided
    if (typeof aiFitScore === 'number' && !Number.isNaN(aiFitScore)) {
      breakdown.aiFit = Math.round(Math.max(0, Math.min(100, aiFitScore)));
    }

    // final weighted sum (include aiFit)
    const final = Math.round(
      (breakdown.prestige * (weights.prestige ?? 0) +
        breakdown.academics * (weights.academics ?? 0) +
        breakdown.cost * (weights.cost ?? 0) +
        breakdown.aid * (weights.aid ?? 0) +
        breakdown.debt * (weights.debt ?? 0) +
        breakdown.location * (weights.location ?? 0) +
        breakdown.size * (weights.size ?? 0) +
        breakdown.setting * (weights.setting ?? 0) +
        (breakdown.aiFit ?? 0) * (weights.aiFit ?? 0)) /
        100
    );

    breakdown.final = final;
    return breakdown;
  }

  /**
   * Formatting helpers to make numeric values human-friendly for clients.
   */
  private formatCurrency(val?: number | null) {
    if (typeof val !== 'number' || Number.isNaN(val)) return 'N/A';
    return val.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  }

  private formatPercent(val?: number | null) {
    if (typeof val !== 'number' || Number.isNaN(val)) return 'N/A';
    return `${Math.round(val)}%`;
  }

  private humanizeDimensionKey(k: string) {
    const map: Record<string, string> = {
      academics: 'Academic Match',
      gpa: 'GPA Fit',
      prestige: 'Prestige Match',
      cost: 'Cost Match',
      aid: 'Financial Aid Match',
      debt: 'Debt Match',
      location: 'Location Match',
      size: 'Size Match',
      setting: 'Setting Match',
      aiFit: 'Search Match',
      final: 'Overall Match',
    };
    return map[k] ?? k;
  }

  /**
   * Turn numeric breakdown into a human-readable map (strings).
   */
  private formatBreakdown(breakdown: Record<string, number>, college?: College) {
    const out: Record<string, string> = {};
    Object.entries(breakdown).forEach(([k, v]) => {
      if (k === 'aiFit') {
        out[this.humanizeDimensionKey(k)] = this.formatPercent(v);
        return;
      }
      if (k === 'cost' && typeof college?.tuition === 'number') {
        out[this.humanizeDimensionKey(k)] = `${this.formatPercent(v)} (typical tuition ${this.formatCurrency(college.tuition)})`;
      } else if (k === 'debt' && typeof college?.medianDebtCompletersOverall === 'number') {
        out[this.humanizeDimensionKey(k)] = `${this.formatPercent(v)} (median debt ${this.formatCurrency(college.medianDebtCompletersOverall)})`;
      } else if (k === 'aid') {
        const pr = this.normalizeRate(college?.pellGrantRate);
        if (typeof college?.pellGrantRate === 'number' && pr !== null) {
          out[this.humanizeDimensionKey(k)] = `${this.formatPercent(v)} (Pell grant rate ${this.formatPercent(pr * 100)})`;
        } else {
          out[this.humanizeDimensionKey(k)] = this.formatPercent(v);
        }
      } else if (k === 'academics') {
        const ar = this.normalizeRate(college?.admissionRate);
        if (typeof college?.admissionRate === 'number' && ar !== null) {
          out[this.humanizeDimensionKey(k)] = `${this.formatPercent(v)} (admission rate ${this.formatPercent(ar * 100)})`;
        } else {
          out[this.humanizeDimensionKey(k)] = this.formatPercent(v);
        }
      } else if (k === 'final') {
        out[this.humanizeDimensionKey(k)] = `${v}/100`;
      } else {
        out[this.humanizeDimensionKey(k)] = this.formatPercent(v);
      }
    });
    return out;
  }

  private formatScoreText(score?: number) {
    if (typeof score !== 'number' || Number.isNaN(score)) return 'N/A';
    return `${Math.round(score)}/100`;
  }

  /**
   * Detect missing inputs (either from the college record or user/questionnaire)
   * that would reduce confidence in the match score. Returns a list of keys.
   */
  private computeMissingSignals(college: College | null | undefined, userProfile: any, questionnaire: any) {
    const missing: string[] = [];
    try {
      if (!college) {
        missing.push('college.missingRecord');
        return missing;
      }

      if (!Array.isArray(college.programs) || college.programs.length === 0) missing.push('college.programs');
      if (!userProfile?.major) missing.push('user.major');

      if (typeof college.tuition !== 'number') missing.push('college.tuition');
      if (!questionnaire?.costOfAttendance) missing.push('questionnaire.costOfAttendance');

      if (typeof college.pellGrantRate !== 'number') missing.push('college.pellGrantRate');
      // questionnaire may include aid-related signals (not always present)
      if (!questionnaire?.inStateOutOfState && !questionnaire?.costOfAttendance) missing.push('questionnaire.geography');

      if (!college.location || !college.location.state) missing.push('college.location.state');
      if (!questionnaire?.location) missing.push('questionnaire.location');

      if (!college.size) missing.push('college.size');
      if (!questionnaire?.classSize && !questionnaire?.collegeSize) missing.push('questionnaire.classSize');

      if (!college.setting) missing.push('college.setting');
      if (!questionnaire?.housing && !questionnaire?.settingPreference) missing.push('questionnaire.setting');

      if (typeof college.medianDebtCompletersOverall !== 'number') missing.push('college.medianDebtCompletersOverall');
    } catch {
      // ignore errors, return whatever we collected
    }
    return missing;
  }

  private humanizeMissing(missing: string[]) {
    if (!missing || missing.length === 0) return '';
    const map: Record<string, string> = {
      'college.missingRecord': 'College details not found',
      'college.programs': 'College program list',
      'user.major': 'Declared major',
      'college.tuition': 'Published tuition',
      'questionnaire.costOfAttendance': 'Your cost/budget preference',
      'college.pellGrantRate': 'College Pell grant rate',
      'questionnaire.geography': 'In-state / out-of-state preference',
      'college.location.state': 'College state/location',
      'questionnaire.location': 'Preferred location',
      'college.size': 'College size (small/medium/large)',
      'questionnaire.classSize': 'Preferred class size',
      'college.setting': 'College setting (urban/suburban/rural)',
      'questionnaire.setting': 'Preferred campus setting',
      'college.medianDebtCompletersOverall': 'Median graduate debt',
    };
    const human = missing.map((k) => map[k] ?? k).filter(Boolean);
    return `Missing signals: ${human.join(', ')}`;
  }

  /**
   * Compute a prestige score (0-100) where lower admission rate => higher prestige.
   * If admissionRate is missing, return neutral 50.
   */
  private computePrestige(college: College | null | undefined) {
    try {
      if (!college || typeof college.admissionRate !== 'number' || Number.isNaN(college.admissionRate)) return 50;
      const rate = this.normalizeRate(college.admissionRate);
      if (rate === null) return 50;
      return Math.round((1 - rate) * 100);
    } catch {
      return 50;
    }
  }

  // Normalize rates that may be expressed as 0-1 or 0-100
  private normalizeRate(x?: number | null): number | null {
    if (typeof x !== 'number' || Number.isNaN(x)) return null;
    const r = x > 1 && x <= 100 ? x / 100 : x;
    return Math.min(1, Math.max(0, r));
  }

  // Map of US state abbreviations to full names (used for robust state matching)
  private static readonly ABBR_TO_NAME: Record<string, string> = {
    AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
    HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
    MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
    NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
    SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia'
  };

  // Return true if the college state matches the user's state, accepting either abbreviations or full names
  private stateMatches(collegeState?: string | null, userState?: string | null) {
    const normalize = (s?: string | null) =>
      (s || '').toString().trim().toLowerCase().replace(/\./g, '').replace(/\s+state$/, '');
    const a = normalize(collegeState);
    const b = normalize(userState);
    if (!a || !b) return false;
    if (a === b) return true;

    // If one is a 2-letter code, compare against the other's full name
    if (a.length === 2) {
      const aName = AIService.ABBR_TO_NAME[a.toUpperCase()];
      if (aName && aName.toLowerCase() === b) return true;
    }
    if (b.length === 2) {
      const bName = AIService.ABBR_TO_NAME[b.toUpperCase()];
      if (bName && bName.toLowerCase() === a) return true;
    }

    return false;
  }

  // Helper to apply in-state filtering once and either return the filtered list
  // or tag original results as out-of-state when none match (better UX than empty list)
  private filterOrTagInState<T extends { college?: College; reason?: string; score?: number }>(
    results: T[], wantsInState: boolean, userState?: string | null, maxResults = 12, strict = false
  ): { results: T[]; emptyState?: EmptyState } {
    // Non-mutating sort by score (descending).
    const sortByScore = (arr: T[]) => [...arr].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    if (!wantsInState || !userState) {
      return { results: sortByScore(results).slice(0, maxResults) };
    }

    const filtered = results.filter((r) => this.stateMatches((r.college?.location?.state || ''), userState));

    if (filtered.length) {
      return { results: sortByScore(filtered).slice(0, maxResults) };
    }

    // No in-state matches found.
    if (strict) {
      // strict enforcement: return empty list with explicit emptyState metadata
      return {
        results: [],
        emptyState: {
          code: 'IN_STATE_NO_MATCHES',
          title: 'No in-state matches',
          message: 'We could not find any colleges in your state that match your preferences.',
        },
      };
    }

    // Non-strict: return a tagged copy of original results to indicate they're out-of-state
    const note = 'Out of State (No in-state matches found)';
    const tagged = results.map((r) => ({ ...r, reason: r.reason ? `${r.reason} — ${note}` : note }));
    return { results: sortByScore(tagged).slice(0, maxResults) };
  }

  private applyGuestModeFilter(results: RecommendResult[], effectiveState: string, maxResults: number): RecommendResponse {
    const byState = results.filter((r) => this.stateMatches(r.college?.location?.state, effectiveState));
    if (!byState.length) {
      return {
        results: [],
        emptyState: {
          code: 'IN_STATE_NO_MATCHES',
          title: 'No in-state matches',
          message: `We could not find any colleges in ${effectiveState} that match your preferences.`,
        },
      };
    }

    const sorted = [...byState].sort((a, b) => {
      const aRate = this.normalizeRate(a.college.admissionRate) ?? 1;
      const bRate = this.normalizeRate(b.college.admissionRate) ?? 1;
      return aRate - bRate;
    });

    return { results: sorted.slice(0, maxResults) };
  }

  private createRecommendResult(
    college: College,
    prefWeights: Record<string, number>,
    userProfile: UserProfile | null,
    questionnaire: Questionnaire | null,
    reason?: string,
    aiFitScore?: number,
  ): RecommendResult {
    const breakdown = this.computePreferenceBreakdown(college, prefWeights, userProfile, questionnaire, aiFitScore);
    const score = breakdown.final;
    return {
      college,
      reason,
      breakdown,
      score,
      breakdownHuman: this.formatBreakdown(breakdown, college),
      scoreText: this.formatScoreText(score),
    };
  }

  private parseAiFitScore(raw: unknown): number {
    if (typeof raw === 'number' && !Number.isNaN(raw)) return Math.round(raw);
    if (typeof raw === 'string' && raw.trim().length) {
      const parsed = Number(raw);
      if (!Number.isNaN(parsed)) return Math.round(parsed);
    }
    return 50;
  }

  private topDimensionsReason(breakdown: Record<string, number>): string {
    const topDims = Object.entries(breakdown)
      .filter(([k]) => k !== 'final')
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .slice(0, 2)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    return `Top Fit: ${topDims}`;
  }

  

  /**
   * Generate stub responses based on message content
   */
  private getStubResponse(message: string): string {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('deadline') || lowerMessage.includes('application')) {
      return "Most colleges have application deadlines between November and January. Early Action/Early Decision deadlines are typically in November, while Regular Decision deadlines are in January. I recommend starting your applications at least 2 months before the deadline.";
    }

    if (lowerMessage.includes('essay') || lowerMessage.includes('personal statement')) {
      return "For college essays, focus on showing who you are rather than just listing achievements. Start with a compelling hook, share a specific story or experience, and reflect on what you learned. Most essays are 500-650 words. Would you like tips on brainstorming topics?";
    }

    if (lowerMessage.includes('recommendation') || lowerMessage.includes('letter')) {
      return "Ask teachers who know you well and can speak to your strengths. Approach them at least 4-6 weeks before the deadline. Provide them with your resume, goals, and specific things you'd like them to highlight. Don't forget to send a thank-you note!";
    }

    if (lowerMessage.includes('test') || lowerMessage.includes('sat') || lowerMessage.includes('act')) {
      return "Many colleges are now test-optional, but strong scores can still help your application. The SAT is scored out of 1600 and the ACT out of 36. Consider which format suits your strengths better. Most students take them in junior year with time for a retake if needed.";
    }

    if (lowerMessage.includes('financial aid') || lowerMessage.includes('scholarship')) {
      return "Fill out the FAFSA (Free Application for Federal Student Aid) as soon as possible after October 1st. Many colleges also require the CSS Profile. Look into merit scholarships at your target schools and search for external scholarships through sites like Fastweb and Scholarships.com.";
    }

    // Default response
    return "I'm here to help with your college transfer journey! I can assist with application deadlines, essay tips, recommendation letters, test prep, financial aid, and more. What specific questions do you have?";
  }

  /**
   * Generate personalized roadmap tasks based on user profile
   * STUB: Returns generic tasks
   * TODO: Use Gemini to generate personalized tasks
   */
  async generateRoadmap(userProfile?: UserProfile | null): Promise<string[]> {
    if (isStubMode() || API_CONFIG.gemini.apiKey === 'STUB') {
      await new Promise((resolve) => setTimeout(resolve, 800));

      return [
        'Research colleges that offer your major',
        'Request transcripts from current institution',
        'Draft personal statement about transfer reasons',
        'Identify 2-3 professors for recommendation letters',
        'Create spreadsheet tracking application deadlines',
        'Review transfer credit policies at target schools',
      ];
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.FETCH_TIMEOUT_MS);
      try {
        const response = await fetch(
          `${API_CONFIG.gemini.baseUrl}/models/gemini-1.5-flash:generateContent?key=${API_CONFIG.gemini.apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  role: 'user',
                  parts: [{
                    text: `Generate 6 concise roadmap tasks for a student with this profile: ${JSON.stringify(userProfile)}`,
                  }],
                },
              ],
            }),
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error('Gemini API request failed');
        }

        const data = (await response.json()) as GeminiResponse;
        const parts = data?.candidates?.[0]?.content?.parts ?? [];
        const text = parts.map((p: any) => p?.text ?? '').join('').trim() || '';
        const lines = text
          .split('\n')
          .map((line: string) => line.replace(/^[-*\d.\s]+/, '').trim())
          .filter(Boolean);

        const tasks = lines.length ? lines.slice(0, 6) : [
          'Research colleges that offer your major',
          'Request transcripts from current institution',
          'Draft personal statement about transfer reasons',
          'Identify 2-3 professors for recommendation letters',
          'Create spreadsheet tracking application deadlines',
          'Review transfer credit policies at target schools',
        ];

        await AsyncStorage.setItem(AI_LAST_ROADMAP_KEY, JSON.stringify(tasks));
        return tasks;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      const cached = await AsyncStorage.getItem(AI_LAST_ROADMAP_KEY);
      if (cached) {
        return JSON.parse(cached) as string[];
      }
      throw error;
    }
  }

  /**
   * Recommend colleges using user profile + optional search query as supplementary info.
   * STUB: ranks results from collegeService.getMatches and returns best fits.
   */
  async recommendColleges(options: { query?: string; userProfile?: UserProfile | null; questionnaire?: Questionnaire | null; maxResults?: number } = {}): Promise<RecommendResponse> {
    const { query = '', userProfile = null as UserProfile | null, questionnaire = null as Questionnaire | null, maxResults = 12 } = options;

    // Determine if user strictly wants in-state colleges. Prefer an explicit
    // boolean from the UI: `questionnaire.inStateOnly === true` but remain
    // backwards-compatible with older string fields like "inStateOutOfState"
    // or `geography` that may contain text such as "In State".
    const geoRaw = questionnaire?.inStateOutOfState ?? questionnaire?.geography ?? questionnaire?.locationPreferences;
    const explicitInState =
      questionnaire?.inStateOnly === true ||
      (typeof geoRaw === 'string' && geoRaw.toLowerCase().replace(/[-_]/g, ' ').includes('in state'));

    const wantsInState = explicitInState;
    const strictInState = explicitInState;

    let effectiveState = String(userProfile?.state || '').trim();
    const guestMode = Boolean(userProfile?.isGuest === true);
    if (guestMode) effectiveState = 'Washington';

    if (strictInState && !effectiveState && !guestMode) {
      return {
        results: [],
        emptyState: {
          code: 'IN_STATE_STATE_MISSING',
          title: 'State not set',
          message: 'You asked for in‑state colleges but your profile has no state set. Please add your state in Profile to get in‑state recommendations.',
        },
      };
    }

    const prefWeights = this.buildPreferenceWeights(userProfile, questionnaire, query);
    const applyStatePolicy = (results: RecommendResult[]): RecommendResponse => {
      if (guestMode) return this.applyGuestModeFilter(results, effectiveState, maxResults);
      return this.filterOrTagInState(results, wantsInState, effectiveState, maxResults, strictInState);
    };

    if (isStubMode() || API_CONFIG.gemini.apiKey === 'STUB') {
      await new Promise((resolve) => setTimeout(resolve, 800));
      const candidates = await collegeService.getMatches({});
      const enriched = candidates.map((c) => {
        const base = (c.matchScore ?? 50) as number;
        const breakdown = this.computePreferenceBreakdown(c, prefWeights, userProfile, questionnaire);
        const score = Math.round(base * 0.4 + breakdown.final * 0.6);
        return {
          college: c,
          score,
          breakdown,
          reason: this.topDimensionsReason(breakdown),
          breakdownHuman: this.formatBreakdown(breakdown, c),
          scoreText: this.formatScoreText(score),
        } as RecommendResult;
      });

      return applyStatePolicy(enriched);
    }

    // Live mode: build a single prompt including profile, questionnaire, and supplementary query
    try {
      const prompt = `You are an assistant that recommends colleges. Return a JSON array (no surrounding text) of up to ${maxResults} college objects that are the best matches for this student. Each object should include at least one of: 
- "id" (Scorecard id) OR "name" (exact college name).
Include optional "reason" briefly explaining the match.
Also include an "aiFitScore" numeric property (0-100) that rates how well this college matches the Additional user search input (the "Additional user search input" field). If the search input is empty, return 50 for aiFitScore.

Student profile: ${JSON.stringify(userProfile)}
Questionnaire: ${JSON.stringify(questionnaire)}
Additional user search input (supplementary): ${JSON.stringify(query)}
Preferences weights (derived from student profile/questionnaire): ${JSON.stringify(prefWeights)}

Respond ONLY with valid JSON (an array). Example: [{"id":"12345","name":"Example University","reason":"Matches major and budget","aiFitScore":78}]`;

      const promptWithConstraint = wantsInState && userProfile?.state
        ? `${prompt}
CONSTRAINT: The user STRICTLY requires colleges located in ${String(userProfile.state)}. Do NOT return colleges from other states.`
        : prompt;
      const assistantMsg = await this.chat(promptWithConstraint);
      const text = assistantMsg?.content ?? '';

      const extractJson = (txt: string): any | null => {
        try {
          return JSON.parse(txt);
        } catch (e) {
          const arrayMatch = txt.match(/\[\s*\{[\s\S]*\}\s*\]/m);
          if (arrayMatch) {
            try { return JSON.parse(arrayMatch[0]); } catch {}
          }
          const objMatch = txt.match(/\{[\s\S]*\}/m);
          if (objMatch) {
            try { const parsed = JSON.parse(objMatch[0]); return Array.isArray(parsed) ? parsed : [parsed]; } catch {}
          }
          return null;
        }
      };

      const parsed = extractJson(text);
      if (parsed && Array.isArray(parsed) && parsed.length > 0) {
        const enrichedResults: RecommendResult[] = [];
        for (const item of parsed) {
          if (enrichedResults.length >= maxResults) break;
          try {
            let details: College | null = null;
            if (item?.id) {
              try {
                details = await collegeService.getCollegeDetails(String(item.id));
              } catch {}
            }

            if (!details && item?.name && typeof item.name === 'string') {
              try {
                const list = await collegeService.searchColleges(item.name);
                if (list && list.length) details = list[0];
              } catch {}
            }

            if (!details) continue;
            if (strictInState && effectiveState && !this.stateMatches(details.location?.state, effectiveState)) continue;

            const aiFitScore = this.parseAiFitScore(item?.aiFitScore);
            const reason = typeof item?.reason === 'string' ? item.reason : undefined;
            const result = this.createRecommendResult(details, prefWeights, userProfile, questionnaire, reason, aiFitScore);
            if (!result.reason) {
              result.reason = `Top: ${Object.entries(result.breakdown)
                .filter(([k]) => k !== 'final')
                .sort((a, b) => (b[1] as number) - (a[1] as number))
                .slice(0, 2)
                .map(([k]) => k)
                .join(', ')}`;
            }
            enrichedResults.push(result);
          } catch {
            // ignore
          }
        }

        if (enrichedResults.length) return applyStatePolicy(enrichedResults);
      }

      if (query && query.trim().length >= 3) {
        const list = await collegeService.searchColleges(query.trim());
        const enriched = list.slice(0, maxResults).map((c) => this.createRecommendResult(c, prefWeights, userProfile, questionnaire));
        return applyStatePolicy(enriched);
      }

      const matches = await collegeService.getMatches({});
      const enrichedMatches = matches.slice(0, maxResults).map((c) => this.createRecommendResult(c, prefWeights, userProfile, questionnaire));
      return applyStatePolicy(enrichedMatches);
    } catch {
      const matches = await collegeService.getMatches({});
      const enrichedMatches = matches.slice(0, maxResults).map((c) => this.createRecommendResult(c, prefWeights, userProfile, questionnaire));
      return applyStatePolicy(enrichedMatches);
    }
  }
}

export const aiService = new AIService();
