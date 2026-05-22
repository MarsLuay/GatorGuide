import AsyncStorage from '@react-native-async-storage/async-storage';

import { isStubMode } from '@/services/app/config';
import { getLocationRegionStates, normalizeLocationPreference, parseLocationPreference } from '@/services/app/questionnaire.enums';
import { aiGatewayService } from '@/services/ai/ai-gateway.service';
import { AI_FACTOR_CACHE_KEY, AI_FACTOR_CACHE_MAX_ENTRIES, type AiFactorCacheEntry } from '@/services/ai/ai.constants';
import type { College } from '@/services/colleges/college.service';
import type {
  EmptyState,
  MajorEvidenceLevel,
  PreferenceBreakdown,
  Questionnaire,
  RecommendResponse,
  RecommendResult,
  UserProfile,
} from '@/services/ai/ai.types';

type CollegeScorecardExtras = College & {
  ownership?: string | null;
  isPublic?: boolean;
  degreesAwarded?: {
    predominant?: unknown;
    highest?: unknown;
  };
  raw?: {
    school?: {
      name?: unknown;
    };
  };
};

export class CollegeScoringService {
  protected stableStringify(input: unknown): string {
    if (input === null || typeof input !== 'object') return JSON.stringify(input);
    if (Array.isArray(input)) {
      return `[${input.map((value) => this.stableStringify(value)).join(',')}]`;
    }
    const record = input as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${this.stableStringify(record[key])}`).join(',')}}`;
  }

  protected collegeExtras(college: College | null | undefined): CollegeScorecardExtras | null {
    return college ? (college as CollegeScorecardExtras) : null;
  }

  protected makeAiContextSignature(userProfile: UserProfile | null, questionnaire: Questionnaire, query?: string): string {
    // Stable context signature lets us safely reuse cached AI factors.
    const payload = {
      major: userProfile?.major ?? null,
      gpa: userProfile?.gpa ?? null,
      state: userProfile?.state ?? null,
      query: String(query ?? '').trim().toLowerCase(),
      questionnaire,
    };
    return this.stableStringify(payload);
  }

  protected makeCollegeAiFingerprint(college: {
    id: string | number;
    name: string;
    state: string;
    tuition: unknown;
    setting: unknown;
    size: unknown;
    admissionRate: unknown;
    completionRate: unknown;
    programs: string[];
  }): string {
    return this.stableStringify(college);
  }

  protected async readAiFactorCache(): Promise<Record<string, AiFactorCacheEntry>> {
    try {
      const raw = await AsyncStorage.getItem(AI_FACTOR_CACHE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, AiFactorCacheEntry>;
      if (!parsed || typeof parsed !== 'object') return {};
      return parsed;
    } catch {
      return {};
    }
  }

  protected async writeAiFactorCache(cache: Record<string, AiFactorCacheEntry>): Promise<void> {
    try {
      const entries = Object.entries(cache);
      if (entries.length > AI_FACTOR_CACHE_MAX_ENTRIES) {
        // Trim oldest factor entries first to bound storage growth.
        entries.sort((a, b) => {
          const at = new Date(a[1]?.updatedAt ?? 0).getTime();
          const bt = new Date(b[1]?.updatedAt ?? 0).getTime();
          return bt - at;
        });
        const trimmed = Object.fromEntries(entries.slice(0, AI_FACTOR_CACHE_MAX_ENTRIES));
        await AsyncStorage.setItem(AI_FACTOR_CACHE_KEY, JSON.stringify(trimmed));
        return;
      }
      await AsyncStorage.setItem(AI_FACTOR_CACHE_KEY, JSON.stringify(cache));
    } catch {
      // best-effort cache
    }
  }

  /**
   * Build preference weights from user profile and questionnaire.
   * Returns values in range 0-100 for each preference dimension.
   */
  buildPreferenceWeights(userProfile?: UserProfile | null, questionnaire?: Questionnaire | null, query?: string): Record<string, number> {
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
      if (questionnaire && Object.values(questionnaire).some((v: unknown) => typeof v === 'string' && v.length > 80)) {
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
  scoreCollegeAgainstPreferences(college: College, weights: Record<string, number>, userProfile?: UserProfile | null, questionnaire?: Questionnaire | null): number {
    const breakdown = this.computePreferenceBreakdown(college, weights, userProfile, questionnaire);
    return breakdown.final;
  }

  /**
   * Compute per-dimension breakdown and final score. Returns object with each dimension and final.
   */
  computePreferenceBreakdown(
    college: College,
    weights: Record<string, number>,
    userProfile?: UserProfile | null,
    questionnaire?: Questionnaire | null,
    aiFitScore?: number
  ): PreferenceBreakdown {
    const breakdown: PreferenceBreakdown = { final: 0 };

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
        const extras = this.collegeExtras(college);
        const ownership = String(extras?.ownership ?? '').toLowerCase();
        const isPublic = ownership.includes('public') || extras?.isPublic === true;
        if (this.stateMatches(college?.location?.state, userState) && isPublic) {
          acad += 15;
        }
      } catch {}

      // Completion rate: always factor in (up to +20)
      try {
        let comp = this.toNumber(college.completionRate);
        if (comp !== null) {
          if (comp > 1) comp = comp / 100;
          comp = Math.min(1, Math.max(0, comp));
          acad += Math.round(comp * 20);
        }
      } catch {}
    } catch {}
    breakdown.academics = Math.round(Math.max(0, Math.min(100, acad)));

    // Reuse preference-fit helpers to avoid duplicated tuition/aid/debt/size/setting logic.
    try {
      const pref = this.computePreferenceFit(college, questionnaire ?? {} as Questionnaire);
      breakdown.cost = pref.costFit;
      breakdown.aid = pref.aidFit;
      breakdown.debt = pref.debtFit;
      breakdown.size = pref.sizeFit;
      breakdown.setting = pref.settingFit;
    } catch {
      // Fallback to neutral scores on error
      breakdown.cost = 50;
      breakdown.aid = 50;
      breakdown.debt = 50;
      breakdown.size = 50;
      breakdown.setting = 50;
    }

    // location (kept separate since it's a direct geo match)
    let locScore = 50;
    if (
      questionnaire?.location &&
      college.location?.state &&
      this.locationPreferenceMatchesState(questionnaire.location, college.location?.state, userProfile?.state)
    ) {
      locScore += 25;
    }
    breakdown.location = locScore;

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
  protected formatCurrency(val?: number | null) {
    if (typeof val !== 'number' || Number.isNaN(val)) return 'N/A';
    return val.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  }

  protected formatPercent(val?: number | null) {
    if (typeof val !== 'number' || Number.isNaN(val)) return 'N/A';
    return `${Math.round(val)}%`;
  }

  protected humanizeDimensionKey(k: string) {
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
  protected formatBreakdown(breakdown: Record<string, number>, college?: College) {
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

  protected formatScoreText(score?: number) {
    if (typeof score !== 'number' || Number.isNaN(score)) return 'N/A';
    return `${Math.round(score)}/100`;
  }

  /**
   * Detect missing inputs (either from the college record or user/questionnaire)
   * that would reduce confidence in the match score. Returns a list of keys.
   */
  protected computeMissingSignals(college: College | null | undefined, userProfile: UserProfile | null | undefined, questionnaire: Questionnaire | null | undefined) {
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

  protected humanizeMissing(missing: string[]) {
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
  protected computePrestige(college: College | null | undefined) {
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
  protected normalizeRate(x?: number | null): number | null {
    if (typeof x !== 'number' || Number.isNaN(x)) return null;
    const r = x > 1 && x <= 100 ? x / 100 : x;
    return Math.min(1, Math.max(0, r));
  }

  // Map of US state abbreviations to full names (used for robust state matching)
  protected static readonly ABBR_TO_NAME: Record<string, string> = {
    AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
    HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
    MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
    NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
    SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia'
  };

  // Return true if the college state matches the user's state, accepting either abbreviations or full names
  protected stateMatches(collegeState?: string | null, userState?: string | null) {
    const normalize = (s?: string | null) =>
      (s || '').toString().trim().toLowerCase().replace(/\./g, '').replace(/\s+state$/, '');
    const a = normalize(collegeState);
    const b = normalize(userState);
    if (!a || !b) return false;
    if (a === b) return true;

    // If one is a 2-letter code, compare against the other's full name
    if (a.length === 2) {
      const aName = CollegeScoringService.ABBR_TO_NAME[a.toUpperCase()];
      if (aName && aName.toLowerCase() === b) return true;
    }
    if (b.length === 2) {
      const bName = CollegeScoringService.ABBR_TO_NAME[b.toUpperCase()];
      if (bName && bName.toLowerCase() === a) return true;
    }

    return false;
  }

  protected locationPreferenceMatchesState(
    locationPreference?: string | null,
    collegeState?: string | null,
    userState?: string | null
  ) {
    const parsed = parseLocationPreference(locationPreference);

    switch (parsed.kind) {
      case 'washington_only':
        return this.stateMatches(collegeState, 'Washington');
      case 'near_current_location':
        return this.stateMatches(collegeState, userState);
      case 'state':
        return this.stateMatches(collegeState, parsed.state);
      case 'region':
        return getLocationRegionStates(parsed.regionKey).some((state) => this.stateMatches(collegeState, state));
      case 'other':
        return this.stateMatches(collegeState, parsed.otherText);
      default:
        return false;
    }
  }

  protected locationPreferenceRequestsWashington(locationPreference?: string | null) {
    const parsed = parseLocationPreference(locationPreference);
    if (parsed.kind === 'washington_only') return true;
    if (parsed.kind === 'state') return this.stateMatches(parsed.state, 'Washington');
    if (parsed.kind === 'other') return this.stateMatches(parsed.otherText, 'Washington');
    return false;
  }

  // Convert full state names to 2-letter codes for Scorecard filters.
  protected toStateAbbreviation(state?: string | null) {
    const raw = String(state ?? '').trim();
    if (!raw) return '';
    if (raw.length === 2) return raw.toUpperCase();
    const lower = raw.toLowerCase();
    const found = Object.entries(CollegeScoringService.ABBR_TO_NAME).find(([, name]) => name.toLowerCase() === lower);
    return found ? found[0] : raw.toUpperCase();
  }

  // Helper to apply in-state filtering once and either return the filtered list
  // or tag original results as out-of-state when none match (better UX than empty list)
  protected filterOrTagInState<T extends { college?: College; reason?: string; score?: number }>(
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

  protected applyGuestModeFilter(results: RecommendResult[], effectiveState: string, maxResults: number): RecommendResponse {
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

  protected createRecommendResult(
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

  protected parseAiFitScore(raw: unknown): number {
    if (typeof raw === 'number' && !Number.isNaN(raw)) return Math.round(raw);
    if (typeof raw === 'string' && raw.trim().length) {
      const parsed = Number(raw);
      if (!Number.isNaN(parsed)) return Math.round(parsed);
    }
    return 50;
  }

  protected topDimensionsReason(breakdown: Record<string, number>): string {
    const topDims = Object.entries(breakdown)
      .filter(([k]) => k !== 'final')
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .slice(0, 2)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    return `Top Fit: ${topDims}`;
  }

  protected clamp(value: number, min = 0, max = 100) {
    return Math.max(min, Math.min(max, value));
  }

  protected toNumber(value: unknown): number | null {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : null;
  }

  protected parseGpa(userProfile?: UserProfile | null): { gpa: number | null; valid: boolean } {
    const parsed = this.toNumber(userProfile?.gpa);
    if (parsed === null) return { gpa: null, valid: false };
    if (parsed < 0 || parsed > 4) return { gpa: this.clamp(parsed, 0, 4), valid: false };
    return { gpa: this.clamp(parsed, 0, 4), valid: true };
  }

  protected normalizeQuestionnaire(questionnaire?: Questionnaire | null): Questionnaire {
    const q: Questionnaire = { ...(questionnaire ?? {}) };
    const normalizeKey = (v: unknown) =>
      String(v ?? '')
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, '_');

    const mapCost = (v: unknown) => {
      const k = normalizeKey(v);
      if (!k) return 'no_preference';
      if (k === 'under20k' || k === 'under_20k') return 'under_20k';
      if (k === '20to40k' || k === '20k_to_40k' || k === '20_40k') return '20k_to_40k';
      if (k === '40to60k' || k === '40k_to_60k' || k === '40_60k') return '40k_to_60k';
      if (k === 'over60k' || k === 'over_60k') return 'over_60k';
      if (k === 'no_preference' || k === 'none' || k === 'any') return 'no_preference';
      return k;
    };

    const mapClassSize = (v: unknown) => {
      const k = normalizeKey(v);
      if (!k || k === 'no_preference') return 'no_preference';
      if (k.includes('small')) return 'small';
      if (k.includes('large')) return 'large';
      return 'no_preference';
    };

    const mapHousing = (v: unknown) => {
      const k = normalizeKey(v);
      if (!k || k === 'no_preference') return 'no_preference';
      if (k.includes('off_campus')) return 'off_campus';
      if (k.includes('on_campus')) return 'on_campus';
      if (k.includes('commute')) return 'commute';
      return 'no_preference';
    };

    q.costOfAttendance = mapCost(q.costOfAttendance ?? q.budget);
    q.classSize = mapClassSize(q.classSize ?? q.collegeSize);
    q.transportation = normalizeKey(q.transportation || 'no_preference');
    q.inStateOutOfState = normalizeKey(q.inStateOutOfState || 'no_preference');
    q.housing = mapHousing(q.housing ?? q.housingPreference);
    q.ranking = normalizeKey(q.ranking || 'somewhat_important');
    q.continueEducation = normalizeKey(q.continueEducation || 'maybe');
    q.location = normalizeLocationPreference(q.location);
    return q;
  }

  protected computeGpaAndPrestige(college: College, gpa: number | null, hasValidGpa: boolean) {
    const admission = this.normalizeRate(college.admissionRate);
    if (admission === null) return { gpaFitScore: 50, prestigeScore: 50, shouldApplyCap: false };

    const prestigeScore = Math.round(this.clamp((1 - admission) * 100));
    if (!hasValidGpa || gpa === null) return { gpaFitScore: 50, prestigeScore, shouldApplyCap: false };

    let bandMin = 2.5;
    let bandMax = 3.2;
    if (admission < 0.25) { bandMin = 3.7; bandMax = 4.0; }
    else if (admission <= 0.5) { bandMin = 3.0; bandMax = 3.6; }

    let gpaFitScore = 50;
    if (gpa < bandMin) {
      const deficit = bandMin - gpa;
      gpaFitScore = Math.round(this.clamp(90 - deficit * 80));
    } else if (gpa <= bandMax) {
      const within = (gpa - bandMin) / Math.max(0.01, bandMax - bandMin);
      gpaFitScore = Math.round(80 + within * 20);
    } else {
      const bonus = Math.min(10, Math.round((gpa - bandMax) * 10));
      gpaFitScore = this.clamp(92 + bonus);
    }

    return { gpaFitScore, prestigeScore, shouldApplyCap: true };
  }

  protected getMajorEvidenceSpec(userMajor: string): {
    cip6: string[];
    cip4: string[];
    keywords: string[];
    academic: boolean;
    pathway: 'cs' | 'business' | 'nursing' | null;
  } {
    const m = String(userMajor ?? '').toLowerCase().trim();
    if (!m) return { cip6: [], cip4: [], keywords: [], academic: false, pathway: null };

    if (m.includes('computer science') || m.includes('software engineering') || m.includes('informatics') || m.includes('cybersecurity')) {
      return {
        cip6: ['110701', '110801', '111001', '111003', '111004', '111005'],
        cip4: ['1107', '1108', '1110'],
        keywords: this.majorKeywordVariants(m),
        academic: true,
        pathway: 'cs',
      };
    }
    if (m.includes('nursing')) {
      return {
        cip6: ['513801', '513805', '513817'],
        cip4: ['5138'],
        keywords: this.majorKeywordVariants(m),
        academic: true,
        pathway: 'nursing',
      };
    }
    if (m.includes('psychology')) {
      return {
        cip6: ['420101', '420201', '420301', '420799'],
        cip4: ['4201', '4202', '4203', '4207'],
        keywords: this.majorKeywordVariants(m),
        academic: true,
        pathway: null,
      };
    }
    if (m.includes('business') || m.includes('accounting') || m.includes('finance')) {
      return {
        cip6: ['520201', '520301', '520801', '520701'],
        cip4: ['5202', '5203', '5208', '5207'],
        keywords: this.majorKeywordVariants(m),
        academic: true,
        pathway: 'business',
      };
    }

    return {
      cip6: [],
      cip4: [],
      keywords: this.majorKeywordVariants(m),
      academic: this.isStrictAcademicQuery(m),
      pathway: null,
    };
  }

  protected normalizeInstitutionName(name: string): string {
    return String(name ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  protected isWaMrpParticipant(pathway: 'cs' | 'business' | 'nursing' | null, college: College): boolean {
    if (!pathway) return false;
    if (!this.stateMatches(college?.location?.state, 'Washington')) return false;

    const n = this.normalizeInstitutionName(String(college?.name ?? ''));
    const participants: Record<'cs' | 'business' | 'nursing', string[]> = {
      cs: [
        'central washington university',
        'eastern washington university',
        'the evergreen state college',
        'university of washington',
        'washington state university',
        'western washington university',
        'gonzaga university',
        'heritage university',
        'pacific lutheran university',
        'saint martins university',
        'saint martin s university',
        'seattle pacific university',
        'seattle university',
        'university of puget sound',
        'walla walla university',
        'whitworth university',
      ],
      business: [
        'central washington university',
        'eastern washington university',
        'the evergreen state college',
        'university of washington',
        'washington state university',
        'western washington university',
        'gonzaga university',
        'heritage university',
        'pacific lutheran university',
        'saint martins university',
        'saint martin s university',
        'seattle pacific university',
        'seattle university',
        'walla walla university',
        'whitworth university',
      ],
      nursing: [
        'university of washington',
        'washington state university',
        'western washington university',
        'saint martins university',
        'saint martin s university',
        'western governors university washington',
        'western governors university',
      ],
    };

    return participants[pathway].some((p) => n.includes(p));
  }

  protected computeMajorEvidence(college: College, major?: string | null): {
    fit: number;
    evidenceCount: number;
    evidenceLevel: MajorEvidenceLevel;
    waMrpParticipant: boolean;
    majorPoints: number;
  } {
    const userMajor = String(major ?? '').trim().toLowerCase();
    if (!userMajor) return { fit: 50, evidenceCount: 0, evidenceLevel: 'D', waMrpParticipant: false, majorPoints: 0 };
    const spec = this.getMajorEvidenceSpec(userMajor);
    const programEntries = Array.isArray(college.programs) ? college.programs : [];
    const programText = programEntries
      .map((p) => String(p ?? '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim())
      .filter(Boolean);
    const programDigits = programEntries
      .map((p) => String(p ?? '').replace(/\D/g, ''))
      .filter((d) => d.length >= 4);

    const normalizedMajor = userMajor.replace(/[^a-z0-9\s]/g, ' ').trim();
    const exactTitleCount = programText.filter((p) => p === normalizedMajor).length;
    const containsTitleCount = programText.filter((p) => p.includes(normalizedMajor)).length;
    const cip6Count = spec.cip6.length > 0
      ? programDigits.filter((d) => spec.cip6.includes(d.slice(0, 6))).length
      : 0;
    const cip4Count = spec.cip4.length > 0
      ? programDigits.filter((d) => spec.cip4.includes(d.slice(0, 4))).length
      : 0;

    const keywordScore = this.computeMajorKeywordFit(college, userMajor);
    const keywordEvidence = keywordScore >= 70 ? 1 : 0;
    const evidenceCount = exactTitleCount * 3 + cip6Count * 3 + cip4Count * 2 + containsTitleCount * 2 + keywordEvidence;
    const waMrpParticipant = this.isWaMrpParticipant(spec.pathway, college);
    const hasA = exactTitleCount > 0 || cip6Count > 0;
    const hasB = cip4Count > 0 || containsTitleCount > 0;
    const hasD = keywordScore >= 70;
    const evidenceLevel: MajorEvidenceLevel = hasA ? 'A' : hasB ? 'B' : waMrpParticipant ? 'C' : hasD ? 'D' : 'E';
    const majorPointsMap: Record<MajorEvidenceLevel, number> = { A: 35, B: 26, C: 12, D: 6, E: -20 };
    const majorPoints = majorPointsMap[evidenceLevel] + (waMrpParticipant ? 6 : 0);

    // Prefer hard program evidence over keyword-only matches.
    if (exactTitleCount > 0) return { fit: 92, evidenceCount, evidenceLevel, waMrpParticipant, majorPoints };
    if (cip6Count > 0) return { fit: this.clamp(88 + Math.min(4, cip6Count)), evidenceCount, evidenceLevel, waMrpParticipant, majorPoints };
    if (cip4Count > 0) return { fit: this.clamp(78 + Math.min(6, cip4Count)), evidenceCount, evidenceLevel, waMrpParticipant, majorPoints };
    if (containsTitleCount > 0) return { fit: normalizedMajor.includes(' ') ? 80 : 74, evidenceCount, evidenceLevel, waMrpParticipant, majorPoints };
    if (keywordScore >= 70) return { fit: 60, evidenceCount, evidenceLevel, waMrpParticipant, majorPoints };

    // Near-gate: for academic major queries with no strong evidence, keep score low.
    if (spec.academic) return { fit: 15, evidenceCount: 0, evidenceLevel, waMrpParticipant, majorPoints };
    return { fit: 45, evidenceCount: 0, evidenceLevel, waMrpParticipant, majorPoints };
  }

  protected computeMajorKeywordFit(college: College, userMajor: string): number {
    const extras = this.collegeExtras(college);
    const haystack = [
      college?.name,
      extras?.degreesAwarded?.predominant,
      extras?.degreesAwarded?.highest,
      extras?.raw?.school?.name,
    ]
      .map((v) => String(v ?? '').toLowerCase())
      .join(' ');

    const variants = this.majorKeywordVariants(userMajor);
    if (!variants.length) return 50;

    const hasStrong = variants.some((k) => haystack.includes(k));
    if (hasStrong) return 72;

    // Prevent false positives for "computer science" from generic "science" only.
    if (userMajor.includes('computer science')) {
      const csSignals = [
        'computer',
        'computing',
        'informatics',
        'software',
        'programming',
        'information technology',
        'cybersecurity',
      ];
      const hasCsSignal = csSignals.some((s) => haystack.includes(s));
      return hasCsSignal ? 62 : 50;
    }

    const tokenHits = userMajor
      .split(/\s+/)
      .filter(Boolean)
      .filter((t) => haystack.includes(t)).length;
    if (tokenHits >= 2) return 62;
    if (tokenHits === 1) return 56;
    return 50;
  }

  protected majorKeywordVariants(userMajor: string): string[] {
    const m = String(userMajor ?? '').toLowerCase().trim();
    if (!m) return [];
    if (m.includes('computer science')) {
      return ['computer science', 'informatics', 'computing', 'software engineering', 'information technology', 'cybersecurity'];
    }
    if (m.includes('business')) return ['business', 'business administration', 'management', 'finance', 'accounting'];
    if (m.includes('nursing')) return ['nursing', 'health science', 'health sciences'];
    if (m.includes('engineering')) return ['engineering', 'mechanical engineering', 'electrical engineering', 'civil engineering'];
    return [m];
  }

  protected costFitFromTuition(costPref: string, tuition: number | null) {
    if (tuition === null) return 50;
    if (costPref === 'no_preference') return 50;
    if (costPref === 'under_20k') return tuition <= 20000 ? 95 : tuition <= 30000 ? 70 : tuition <= 45000 ? 40 : 15;
    if (costPref === '20k_to_40k') return tuition >= 20000 && tuition <= 40000 ? 95 : tuition < 20000 ? 80 : tuition <= 50000 ? 65 : 30;
    if (costPref === '40k_to_60k') return tuition >= 40000 && tuition <= 60000 ? 90 : tuition < 40000 ? 70 : 55;
    if (costPref === 'over_60k') return tuition >= 60000 ? 90 : 60;
    return 50;
  }

  protected debtFitFromPreference(costPref: string, debt: number | null) {
    if (debt === null) return 50;
    if (costPref === 'no_preference') return 50;
    if (costPref === 'under_20k') return debt <= 15000 ? 95 : debt <= 25000 ? 70 : debt <= 35000 ? 40 : 15;
    if (costPref === '20k_to_40k') return debt <= 20000 ? 85 : debt <= 30000 ? 70 : debt <= 40000 ? 45 : 25;
    if (costPref === '40k_to_60k') return debt <= 25000 ? 80 : debt <= 35000 ? 65 : 45;
    if (costPref === 'over_60k') return debt <= 45000 ? 70 : 50;
    return 50;
  }

  protected aidFitFromPreference(costPref: string, pellRate: number | null) {
    if (pellRate === null) return 50;
    if (costPref === 'no_preference') return 50;
    const p = this.normalizeRate(pellRate);
    if (p === null) return 50;
    if (costPref === 'under_20k') return Math.round(40 + p * 60);
    if (costPref === '20k_to_40k') return Math.round(50 + p * 40);
    if (costPref === '40k_to_60k') return Math.round(55 + p * 30);
    return Math.round(60 - p * 20);
  }

  protected sizeFitFromPreference(classSize: string, size: College['size']) {
    if (!size || size === 'unknown') return 50;
    if (classSize === 'no_preference') return 50;
    if (classSize === 'small') return size === 'small' ? 95 : size === 'medium' ? 65 : 35;
    if (classSize === 'large') return size === 'large' ? 95 : size === 'medium' ? 70 : 40;
    return 50;
  }

  protected settingFitFromPreference(transportation: string, housing: string, setting: College['setting']) {
    if (!setting) return 50;
    const scores: number[] = [];
    if (transportation === 'transit' || transportation === 'walk' || transportation === 'bike') scores.push(setting === 'urban' ? 90 : 45);
    if (transportation === 'car') scores.push(setting === 'suburban' || setting === 'rural' ? 80 : 60);
    if (housing === 'off_campus') scores.push(setting === 'urban' ? 80 : 55);
    if (housing === 'commute') scores.push(setting === 'suburban' ? 80 : setting === 'urban' ? 70 : 60);
    if (housing === 'on_campus') scores.push(50);
    if (!scores.length) return 50;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }

  protected computePreferenceFit(college: College, questionnaire: Questionnaire) {
    const tuition = this.toNumber(college.tuition);
    const debt = this.toNumber(college.medianDebtCompletersOverall);
    const pell = this.toNumber(college.pellGrantRate);
    const costPref = String(questionnaire.costOfAttendance ?? 'no_preference');
    const costPrefActive = costPref !== 'no_preference';

    const costFit = this.costFitFromTuition(costPref, tuition);
    const debtFit = this.debtFitFromPreference(costPref, debt);
    const aidFit = this.aidFitFromPreference(costPref, pell);
    const sizeFit = this.sizeFitFromPreference(String(questionnaire.classSize ?? 'no_preference'), college.size);
    const settingFit = this.settingFitFromPreference(String(questionnaire.transportation ?? 'no_preference'), String(questionnaire.housing ?? 'no_preference'), college.setting);

    let preferenceFit = 50;
    if (costPrefActive) {
      // When user specifies a budget preference, make cost/aid/debt dominate preference fit.
      const weighted =
        costFit * 0.45 +
        debtFit * 0.30 +
        aidFit * 0.20 +
        sizeFit * 0.03 +
        settingFit * 0.02;
      preferenceFit = Math.round(weighted);
    } else {
      const subscores = [costFit, debtFit, aidFit, sizeFit, settingFit].filter((v) => typeof v === 'number');
      preferenceFit = subscores.length ? Math.round(subscores.reduce((a, b) => a + b, 0) / subscores.length) : 50;
    }
    return { preferenceFit, costFit, debtFit, aidFit, sizeFit, settingFit, costPrefActive };
  }

  protected rankImportanceAdjustments(questionnaire: Questionnaire) {
    const ranking = String(questionnaire.ranking ?? 'somewhat_important');
    const continueEdu = String(questionnaire.continueEducation ?? 'maybe');

    let gpaWeight = 0.35;
    let prestigeWeight = 0.25;
    let majorWeight = 0.2;
    let preferenceWeight = 0.2;
    const costPref = String(questionnaire.costOfAttendance ?? 'no_preference');

    if (ranking === 'very_important') { prestigeWeight += 0.08; gpaWeight += 0.05; preferenceWeight -= 0.08; majorWeight -= 0.05; }
    if (ranking === 'not_important') { prestigeWeight -= 0.07; gpaWeight += 0.05; preferenceWeight += 0.02; }
    if (continueEdu === 'yes') { prestigeWeight += 0.04; majorWeight += 0.03; preferenceWeight -= 0.07; }
    if (continueEdu === 'no') { preferenceWeight += 0.07; prestigeWeight -= 0.04; majorWeight -= 0.03; }
    if (costPref !== 'no_preference') {
      // Budget-aware mode: increase contribution of preference fit.
      preferenceWeight += 0.25;
      prestigeWeight -= 0.12;
      gpaWeight -= 0.10;
      majorWeight -= 0.03;
    }

    const total = gpaWeight + prestigeWeight + majorWeight + preferenceWeight;
    return {
      gpaWeight: gpaWeight / total,
      prestigeWeight: prestigeWeight / total,
      majorWeight: majorWeight / total,
      preferenceWeight: preferenceWeight / total,
    };
  }

  protected truncateText(input: unknown, max = 300) {
    const text = String(input ?? '');
    return text.length > max ? `${text.slice(0, max)}…` : text;
  }

  protected computeQueryMatchScore(college: College, query: string): number {
    const q = this.sanitizeQueryText(query).toLowerCase();
    if (q.length < 2) return 50;

    const tokens = q.split(/\s+/).filter(Boolean);
    if (!tokens.length) return 50;

    const name = String(college.name ?? '').toLowerCase();
    const programs = Array.isArray(college.programs)
      ? college.programs.map((p) => String(p ?? '').toLowerCase())
      : [];

    const strongNameMatch = name.includes(q);
    const strongProgramMatch = programs.some((p) => p.includes(q));
    if (strongNameMatch) return tokens.length === 1 ? 80 : 100;
    if (strongProgramMatch) return tokens.length === 1 ? 75 : 95;

    // For multi-word queries, avoid over-boosting generic partial token hits
    // (e.g., "science" matching unrelated schools for "computer science").
    if (tokens.length >= 2) {
      const uniqueTokens = Array.from(new Set(tokens));
      const tokenPresent = (t: string) => name.includes(t) || programs.some((p) => p.includes(t));
      const hitTokens = uniqueTokens.filter(tokenPresent);
      const allTokensPresent = hitTokens.length === uniqueTokens.length;
      const sameProgramHasAll = programs.some((p) => uniqueTokens.every((t) => p.includes(t)));
      const nameHasAll = uniqueTokens.every((t) => name.includes(t));

      if (sameProgramHasAll || nameHasAll) return 85;
      if (allTokensPresent) return 70;
      if (hitTokens.length >= 2) return 55;
      if (hitTokens.length === 1) return 30;
      return 20;
    }

    // Single-word query behavior with stricter tiers.
    const token = tokens[0];
    const tokenRx = new RegExp(`\\b${this.escapeRegExp(token)}\\b`, 'i');
    const exactProgram = programs.some((p) => {
      const normalized = String(p ?? '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
      return normalized === token;
    });
    const startsProgram = programs.some((p) => {
      const normalized = String(p ?? '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
      return normalized.startsWith(`${token} `);
    });
    const wordInProgram = programs.some((p) => tokenRx.test(String(p ?? '')));
    const wordInName = tokenRx.test(name);

    if (exactProgram) return 75;
    if (startsProgram) return 70;
    if (wordInProgram) return 64;
    if (wordInName) return 58;
    return 20;
  }

  protected computeQueryBoost(
    queryMatch: number | null,
    majorFit: number,
    strictAcademicQuery: boolean,
    evidenceLevel?: MajorEvidenceLevel,
    majorHint?: string | null
  ): number {
    if (queryMatch === null) return 0;
    if (strictAcademicQuery && majorFit < 70) return 0;
    if (strictAcademicQuery && (evidenceLevel === 'D' || evidenceLevel === 'E')) return 0;
    const isCs = String(majorHint ?? '').toLowerCase().includes('computer science');
    if (strictAcademicQuery && majorFit < 80) return queryMatch >= 90 ? 2 : queryMatch >= 80 ? 1 : 0;
    if (queryMatch >= 90) return isCs && strictAcademicQuery ? 4 : 8;
    if (queryMatch >= 80) return 5;
    if (queryMatch >= 70) return 2;
    if (queryMatch >= 60) return 1;
    return 0;
  }

  protected inferInstitutionLevel(college: College): '2-year' | '4-year' | 'unknown' {
    const extras = this.collegeExtras(college);
    const highest = String(extras?.degreesAwarded?.highest ?? '').toLowerCase();
    const predominant = String(extras?.degreesAwarded?.predominant ?? '').toLowerCase();
    const name = String(college?.name ?? '').toLowerCase();

    if (highest.includes('2') || highest.includes('two') || predominant.includes('associate')) return '2-year';
    if (highest.includes('4') || highest.includes('four') || predominant.includes('bachelor') || predominant.includes('masters') || predominant.includes('doctor')) return '4-year';
    if (name.includes('community college')) return '2-year';
    if (name.includes('university')) return '4-year';
    return 'unknown';
  }

  protected detectTransferIntentExplicit(query: string, questionnaire: Questionnaire): boolean {
    const q = String(query ?? '').toLowerCase();
    const text = [
      q,
      questionnaire?.careerGoals,
      questionnaire?.programs,
      questionnaire?.extracurriculars,
      questionnaire?.companiesNearby,
      questionnaire?.volunteerActivities,
    ]
      .map((v) => String(v ?? '').toLowerCase())
      .join(' ');

    return /transfer|associate|2-year|two year|community college|cc\b|start at.*college|pathway/.test(text);
  }

  protected institutionPreferenceAdjustment(
    level: '2-year' | '4-year' | 'unknown',
    continueEducation: string,
    transferIntentExplicit: boolean
  ): number {
    if (level === 'unknown') return 0;

    // Explicit transfer intent gets priority.
    if (transferIntentExplicit) return level === '2-year' ? 8 : -6;

    if (continueEducation === 'yes') return level === '4-year' ? 8 : -6;
    if (continueEducation === 'no') return level === '2-year' ? 6 : -4;
    return 0;
  }

  protected csPathAdjustment(
    level: '2-year' | '4-year' | 'unknown',
    majorHint: string | null | undefined,
    transferIntentExplicit: boolean
  ): number {
    const m = String(majorHint ?? '').toLowerCase();
    if (!m.includes('computer science')) return 0;
    if (level === 'unknown') return 0;
    if (transferIntentExplicit) return level === '2-year' ? 4 : -3;
    return level === '4-year' ? 4 : -3;
  }

  protected isVocationalInstitutionName(name?: string | null): boolean {
    const n = String(name ?? '').toLowerCase();
    if (!n) return false;
    const allowlist = /university|community college|state university|college/.test(n);
    const hardVocational = /beauty|barber|cosmetology|nail|massage|esthetic|esthetics|hairdressing|truck|trucking|driving school|welding|culinary|flight school/.test(n);
    if (hardVocational) return true;

    const softVocational = /medical institute|arts & sciences institute|institute of|academy/.test(n);
    if (softVocational && !allowlist) return true;

    return false;
  }

  protected queryExplicitlyRequestsVocational(query: string): boolean {
    const q = String(query ?? '').toLowerCase();
    return /beauty|barber|cosmetology|trade school|vocational|technical institute|welding|culinary|driving school|truck|trucking/.test(q);
  }

  protected escapeRegExp(input: string): string {
    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  protected isHighSignalSingleWordMajor(token: string): boolean {
    const t = String(token ?? '').toLowerCase().trim();
    if (!t) return false;
    const majors = new Set([
      'nursing',
      'accounting',
      'finance',
      'biology',
      'chemistry',
      'physics',
      'mathematics',
      'economics',
      'psychology',
      'engineering',
      'cybersecurity',
      'informatics',
      'business',
    ]);
    return majors.has(t);
  }

  protected sanitizeQueryText(query: string): string {
    return String(query ?? '')
      .trim()
      .replace(/^[`'"“”‘’.,!?;:()\[\]{}<>\\\/|_-]+/, '')
      .replace(/[`'"“”‘’.,!?;:()\[\]{}<>\\\/|_-]+$/, '')
      .trim();
  }

  protected isStrictAcademicQuery(query: string): boolean {
    const q = this.sanitizeQueryText(query).toLowerCase();
    const tokens = q.split(/\s+/).filter(Boolean);
    if (tokens.length === 1) return this.isHighSignalSingleWordMajor(tokens[0]);
    if (tokens.length < 2) return false;
    if (!/^[a-z\s]+$/.test(q)) return false;
    return true;
  }

  protected matchesAcademicQuery(college: College, query: string, inferredMajor?: string | null): boolean {
    const q = this.sanitizeQueryText(query).toLowerCase();
    if (!q) return false;
    const tokens = Array.from(new Set(q.split(/\s+/).filter(Boolean)));
    if (!tokens.length) return false;

    const extras = this.collegeExtras(college);
    const haystack = [
      college?.name,
      ...(Array.isArray(college?.programs) ? college.programs : []),
      extras?.degreesAwarded?.predominant,
      extras?.degreesAwarded?.highest,
      extras?.raw?.school?.name,
    ]
      .map((v) => String(v ?? '').toLowerCase())
      .join(' ');

    if (haystack.includes(q)) return true;

    const majorHint = String(inferredMajor ?? '').trim().toLowerCase();
    if (majorHint) {
      const variants = this.majorKeywordVariants(majorHint);
      if (variants.some((v) => haystack.includes(v))) return true;
    }

    if (tokens.length === 1) {
      const t = tokens[0];
      const rx = new RegExp(`\\b${this.escapeRegExp(t)}\\b`, 'i');
      const inPrograms = Array.isArray(college.programs) && college.programs.some((p) => rx.test(String(p ?? '')));
      const inName = rx.test(String(college?.name ?? ''));
      return inPrograms || inName;
    }

    // Multi-word academic query requires all tokens to be present to avoid noise.
    return tokens.every((t) => haystack.includes(t));
  }

  protected inferMajorFromQuery(query: string): string | null {
    const q = this.sanitizeQueryText(query).toLowerCase();
    if (q.length < 4) return null;

    const blocked = /(^|\s)(test|help|college|school|transfer|best|top|near me)(\s|$)/;
    if (blocked.test(q) && q.split(/\s+/).length <= 2) return null;

    const knownMajors = [
      'computer science',
      'software engineering',
      'data science',
      'information technology',
      'cybersecurity',
      'electrical engineering',
      'mechanical engineering',
      'civil engineering',
      'business administration',
      'finance',
      'accounting',
      'nursing',
      'biology',
      'chemistry',
      'psychology',
      'economics',
      'education',
      'mathematics',
      'physics',
      'communications',
    ];
    const matched = knownMajors.find((m) => q.includes(m));
    if (matched) return matched;

    const words = q.split(/\s+/).filter(Boolean);
    if (words.length === 1 && this.isHighSignalSingleWordMajor(words[0])) return words[0];
    if (words.length >= 2 && words.length <= 3 && /^[a-z\s]+$/.test(q)) return q;
    return null;
  }

  protected async computeAiFactors(candidates: { college: College; finalBaseScore: number }[], userProfile: UserProfile | null, questionnaire: Questionnaire, query?: string): Promise<Record<string, number>> {
    if (!candidates.length || isStubMode()) {
      return Object.fromEntries(candidates.map((c) => [c.college.id, 50]));
    }

    const serializedColleges = candidates.map(({ college }) => ({
      id: college.id,
      name: college.name,
      state: college.location?.state ?? '',
      tuition: college.tuition,
      setting: college.setting ?? null,
      size: college.size ?? null,
      admissionRate: college.admissionRate,
      completionRate: college.completionRate ?? null,
      programs: Array.isArray(college.programs) ? college.programs.slice(0, 10) : [],
    }));

    const contextSignature = this.makeAiContextSignature(userProfile, questionnaire, query);
    const cache = await this.readAiFactorCache();
    const output: Record<string, number> = {};
    const pending: typeof serializedColleges = [];

    for (const college of serializedColleges) {
      const fingerprint = this.makeCollegeAiFingerprint(college);
      const cacheKey = `${String(college.id)}::${contextSignature}`;
      const cached = cache[cacheKey];
      if (cached && cached.fingerprint === fingerprint && Number.isFinite(Number(cached.aiFactor))) {
        output[String(college.id)] = this.clamp(Number(cached.aiFactor));
      } else {
        pending.push(college);
      }
    }

    if (!pending.length) {
      return Object.fromEntries(candidates.map((c) => [c.college.id, output[String(c.college.id)] ?? 50]));
    }

    try {
      const response = await aiGatewayService.scoreCollegeFactors({
        userProfile,
        questionnaire,
        query,
        colleges: pending,
      });
      const factorMap: Record<string, number> = {};
      for (const item of response.factors ?? []) {
        const id = String(item?.id ?? '');
        if (!id) continue;
        const raw = Number(item?.aiFactor);
        factorMap[id] = Number.isFinite(raw) ? Math.round(this.clamp(raw)) : 50;
      }

      for (const college of pending) {
        const id = String(college.id);
        const aiFactor = factorMap[id] ?? 50;
        output[id] = aiFactor;
        const cacheKey = `${id}::${contextSignature}`;
        cache[cacheKey] = {
          aiFactor,
          fingerprint: this.makeCollegeAiFingerprint(college),
          updatedAt: new Date().toISOString(),
        };
      }
    } catch {
      for (const college of pending) {
        const id = String(college.id);
        output[id] = 50;
      }
    }

    await this.writeAiFactorCache(cache);
    return Object.fromEntries(candidates.map((c) => [c.college.id, output[String(c.college.id)] ?? 50]));
  }
}
