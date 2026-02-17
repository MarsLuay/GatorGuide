// services/ai.service.ts
// AI chat assistant service (Gemini API)
// Currently returns stub responses, will connect to Firebase Function + Gemini later

import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG, isStubMode } from './config';
import { collegeService, College } from './college.service';

const AI_LAST_RESPONSE_KEY = 'ai:lastResponse';
const AI_LAST_ROADMAP_KEY = 'ai:lastRoadmap';

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  source?: 'live' | 'cached' | 'stub';
};

class AIService {
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
        timestamp: new Date(),
        source: 'stub',
      };
    }

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
        }
      );

      if (!response.ok) {
        throw new Error('Gemini API request failed');
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ??
        "I'm here to help with your college journey. What would you like to know?";

      const payload: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: text,
        timestamp: new Date(),
        source: 'live',
      };

      await AsyncStorage.setItem(AI_LAST_RESPONSE_KEY, JSON.stringify(payload));
      return payload;
    } catch (error) {
      const cached = await AsyncStorage.getItem(AI_LAST_RESPONSE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as ChatMessage;
        return { ...parsed, id: `msg-${Date.now()}`, source: 'cached' };
      }
      throw error;
    }
  }

  /**
   * Build preference weights from user profile and questionnaire.
   * Returns values in range 0-100 for each preference dimension.
   */
  buildPreferenceWeights(userProfile: any, questionnaire: any, query?: string) {
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
          const v = geoRaw.toString().toLowerCase();
          if (v.includes('in-state') || v.includes('in state')) {
            // Strongly prefer in-state
            weights.location += 20;
          } else if (v.includes('out-of-state') || v.includes('out of state')) {
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
          if (rankRaw.startsWith('questionnaire.')) rankKey = rankRaw.replace(/^questionnaire\./, '');
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

      // Normalize to sum 100
      const total = Object.values(weights).reduce((s, v) => s + v, 0);
      Object.keys(weights).forEach((k) => {
        weights[k] = Math.round((weights[k] / total) * 100);
      });
    } catch {
      // ignore, return defaults
    }

    return weights;
  }

  /**
   * Simple heuristic scoring of a college against preference weights.
   * Returns a score 0-100 where higher is better.
   */
  scoreCollegeAgainstPreferences(college: College, weights: Record<string, number>, userProfile: any, questionnaire: any) {
    let score = 0;

    // academics: major match & admission rate
    const major = (userProfile?.major || '').toString().toLowerCase();
    let acad = 50;
    if (major && (college.programs || []).some((p) => p.toLowerCase().includes(major))) acad += 30;
    if (typeof college.admissionRate === 'number') {
      // higher admission rate may be better for some; assume higher is easier -> positive
      acad += Math.round((college.admissionRate ?? 0) * 20);
    }
    // incorporate student's GPA into academic fit (if provided)
    try {
      const userGpa = parseFloat(String(userProfile?.gpa ?? ''));
      if (!Number.isNaN(userGpa) && userGpa > 0) {
        const gpaNorm = Math.min(4, Math.max(0, userGpa)) / 4; // 0-1
        acad += Math.round(gpaNorm * 20); // up to +20 influence
      }
    } catch {
      // ignore
    }
    // Transfer-optimized adjustments (apply for ALL users)
    try {
      const offersMajor = major && Array.isArray(college.programs) && (college.programs || []).some((p) => p.toLowerCase().includes(major));
      // Mandatory major match for transfers: heavy penalty if missing
      if (!offersMajor) acad -= 40;

      // Articulation proxy: same state & public ownership -> bonus for likely transferability
      try {
        const userState = (userProfile?.state || '').toString().toLowerCase();
        const collegeState = (college?.location?.state || '').toString().toLowerCase();
        const ownership = ((college as any)?.ownership || '').toString().toLowerCase();
        const isPublic = ownership.includes('public') || (college as any)?.isPublic === true;
        if (userState && collegeState && userState === collegeState && isPublic) {
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
    } catch {
      // ignore
    }
    score += (acad * (weights.academics ?? 0)) / 100;

    // cost: lower tuition preferred when cost weight high
    let costScore = 50;
    if (typeof college.tuition === 'number') {
      const t = college.tuition;
      // heuristically map tuition to 0-100 (lower is better)
      const capped = Math.min(60000, Math.max(0, t));
      costScore = 100 - Math.round((capped / 60000) * 100);
    }
    score += (costScore * (weights.cost ?? 0)) / 100;

    // aid: prefer higher pellGrantRate
    let aidScore = 50;
    if (typeof college.pellGrantRate === 'number') aidScore = Math.round((college.pellGrantRate ?? 0) * 100);
    score += (aidScore * (weights.aid ?? 0)) / 100;

    // debt: prefer lower median debt
    let debtScore = 50;
    if (typeof college.medianDebtCompletersOverall === 'number') {
      const d = Math.min(50000, Math.max(0, college.medianDebtCompletersOverall));
      debtScore = 100 - Math.round((d / 50000) * 100);
    }
    score += (debtScore * (weights.debt ?? 0)) / 100;

    // location/size/setting: simple heuristics from questionnaire/preferences
    let locScore = 50;
    if (questionnaire?.location && college.location?.state && questionnaire.location === college.location.state) locScore += 25;
    score += (locScore * (weights.location ?? 0)) / 100;

    let sizeScore = 50;
    if (questionnaire?.sizePreference && college.size) {
      if (questionnaire.sizePreference === college.size) sizeScore = 100;
    }
    score += (sizeScore * (weights.size ?? 0)) / 100;

    let settingScore = 50;
    if (questionnaire?.settingPreference && college.setting) {
      if (questionnaire.settingPreference === college.setting) settingScore = 100;
    }
    score += (settingScore * (weights.setting ?? 0)) / 100;

    // normalize to 0-100
    const final = Math.round(Math.max(0, Math.min(100, score / 1)));
    return final;
  }

  /**
   * Compute per-dimension breakdown and final score. Returns object with each dimension and final.
   */
  computePreferenceBreakdown(college: College, weights: Record<string, number>, userProfile: any, questionnaire: any, aiFitScore?: number) {
    const breakdown: Record<string, number> = {};

    const major = (userProfile?.major || '').toString().toLowerCase();

    // academics
    let acad = 50;
    if (major && (college.programs || []).some((p) => p.toLowerCase().includes(major))) acad += 30;
    if (typeof college.admissionRate === 'number') acad += Math.round((college.admissionRate ?? 0) * 20);
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
      const offersMajor = major && Array.isArray(college.programs) && (college.programs || []).some((p) => p.toLowerCase().includes(major));
      if (!offersMajor) {
        // Mandatory major match for transfers: heavy penalty if missing
        acad -= 40;
      }

      // Articulation agreement proxy: same state and public college -> bonus
      try {
        const userState = (userProfile?.state || '').toString().toLowerCase();
        const collegeState = (college?.location?.state || '').toString().toLowerCase();
        const ownership = ((college as any)?.ownership || '').toString().toLowerCase();
        const isPublic = ownership.includes('public') || (college as any)?.isPublic === true;
        if (userState && collegeState && userState === collegeState && isPublic) {
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
    if (typeof college.pellGrantRate === 'number') aidScore = Math.round((college.pellGrantRate ?? 0) * 100);
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
    if (questionnaire?.location && college.location?.state && questionnaire.location === college.location.state) locScore += 25;
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
      } else if (k === 'aid' && typeof college?.pellGrantRate === 'number') {
        out[this.humanizeDimensionKey(k)] = `${this.formatPercent(v)} (Pell grant rate ${this.formatPercent(college.pellGrantRate * 100)})`;
      } else if (k === 'academics' && typeof college?.admissionRate === 'number') {
        out[this.humanizeDimensionKey(k)] = `${this.formatPercent(v)} (admission rate ${this.formatPercent(college.admissionRate * 100)})`;
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
      const rate = Math.min(1, Math.max(0, college.admissionRate));
      return Math.round((1 - rate) * 100);
    } catch {
      return 50;
    }
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
  async generateRoadmap(userProfile: any): Promise<string[]> {
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
        }
      );

      if (!response.ok) {
        throw new Error('Gemini API request failed');
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
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
  async recommendColleges(options: { query?: string; userProfile?: any; questionnaire?: any; maxResults?: number } = {}): Promise<Array<{ college: College; reason?: string; breakdown?: Record<string, number>; score?: number }>> {
    const { query = '', userProfile = {}, questionnaire = {}, maxResults = 12 } = options;

    // Determine if user strictly wants in-state colleges
    const wantsInState = (() => {
      try {
        const state = (userProfile?.state || '').toString().trim();
        if (!state) return false;
        const geoFields = [questionnaire?.geography, questionnaire?.locationPreferences, questionnaire?.inStateOutOfState];
        for (const f of geoFields) {
          if (!f) continue;
          try {
            if (String(f).toLowerCase().includes('in-state')) return true;
          } catch {}
        }
      } catch {}
      return false;
    })();

    if (isStubMode() || API_CONFIG.gemini.apiKey === 'STUB') {
      await new Promise((resolve) => setTimeout(resolve, 800));
      // get candidate colleges (stub has lat/lon and matchScore)
      const candidates = await collegeService.getMatches({});

      const q = query.trim().toLowerCase();
      const major = (userProfile?.major || '').toString().toLowerCase();

      // compute student preference weights and score colleges against them
      const prefWeights = this.buildPreferenceWeights(userProfile, questionnaire, query);
      const enriched = candidates.map((c) => {
        const base = (c.matchScore ?? 50) as number;
        const breakdown = this.computePreferenceBreakdown(c, prefWeights, userProfile, questionnaire);
          const aiScore = breakdown.final;
          const score = Math.round(base * 0.4 + aiScore * 0.6);
        const topDims = Object.entries(breakdown)
          .filter(([k]) => k !== 'final')
          .sort((a, b) => (b[1] as number) - (a[1] as number))
          .slice(0, 2)
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ');
        const reason = `Top Fit: ${topDims}`;
        const breakdownHuman = this.formatBreakdown(breakdown, c);
        const scoreText = this.formatScoreText(score);
        return { college: c, score, breakdown, reason, breakdownHuman, scoreText } as any;
      });

      enriched.sort((a, b) => b.score - a.score);
      if (wantsInState && userProfile?.state) {
        const filtered = enriched.filter((r) => (r.college?.location?.state || '').toString().toLowerCase() === userProfile.state.toString().toLowerCase());
        filtered.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
        return filtered.slice(0, maxResults);
      }
      return enriched.slice(0, maxResults);
    }

    // Live mode: build a single prompt including profile, questionnaire, and supplementary query
    try {
      const weights = this.buildPreferenceWeights(userProfile, questionnaire, query);
      const prompt = `You are an assistant that recommends colleges. Return a JSON array (no surrounding text) of up to ${maxResults} college objects that are the best matches for this student. Each object should include at least one of: \n- \"id\" (Scorecard id) OR \"name\" (exact college name).\nInclude optional \"reason\" briefly explaining the match.\nAlso include an \"aiFitScore\" numeric property (0-100) that rates how well this college matches the Additional user search input (the \"Additional user search input\" field). If the search input is empty, return 50 for aiFitScore.\n\nStudent profile: ${JSON.stringify(userProfile)}\nQuestionnaire: ${JSON.stringify(questionnaire)}\nAdditional user search input (supplementary): ${JSON.stringify(query)}\nPreferences weights (derived from student profile/questionnaire): ${JSON.stringify(weights)}\n\nRespond ONLY with valid JSON (an array). Example: [{"id":"12345","name":"Example University","reason":"Matches major and budget","aiFitScore":78}]`;

      // If wantsInState, add strict instruction to the LLM prompt
      const promptWithConstraint = wantsInState && userProfile?.state
        ? `${prompt}\nCONSTRAINT: The user STRICTLY requires colleges located in ${String(userProfile.state)}. Do NOT return colleges from other states.`
        : prompt;
      const assistantMsg = await this.chat(promptWithConstraint);
      const text = assistantMsg?.content ?? '';

      // helper: try to extract JSON substring from text
      const extractJson = (txt: string): any | null => {
        try {
          return JSON.parse(txt);
        } catch (e) {
          // try to find first [...] or {...}
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

      // compute preference weights here so we can apply them to AI results
      const prefWeights = this.buildPreferenceWeights(userProfile, questionnaire, query);

      if (parsed && Array.isArray(parsed) && parsed.length > 0) {
        const enrichedResults: Array<{ college: College; reason?: string; breakdown?: Record<string, number>; score?: number }> = [];
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

            if (details) {
              // parse aiFitScore from assistant response (default 50)
              let aiFitScore = 50;
              try {
                if (typeof item.aiFitScore === 'number' && !Number.isNaN(item.aiFitScore)) aiFitScore = Math.round(item.aiFitScore);
                else if (typeof item.aiFitScore === 'string' && item.aiFitScore.trim().length) {
                  const n = Number(item.aiFitScore);
                  if (!Number.isNaN(n)) aiFitScore = Math.round(n);
                }
              } catch {}

              const breakdown = this.computePreferenceBreakdown(details, prefWeights, userProfile, questionnaire, aiFitScore);
              const score = breakdown.final;
              const reason = item?.reason ?? `Top: ${Object.entries(breakdown).filter(([k]) => k !== 'final').sort((a,b)=> (b[1] as number)-(a[1] as number)).slice(0,2).map(([k,v])=>k).join(', ')}`;
              const breakdownHuman = this.formatBreakdown(breakdown, details);
              const scoreText = this.formatScoreText(score);
              enrichedResults.push({ college: details, reason, breakdown, score, breakdownHuman, scoreText } as any);
            }
          } catch {
            // ignore
          }
        }

        // Apply hard in-state filter if requested
        if (wantsInState && userProfile?.state) {
          const filtered = enrichedResults.filter((r) => (r.college?.location?.state || '').toString().toLowerCase() === userProfile.state.toString().toLowerCase());
          filtered.sort((a,b)=> (b.score ?? 0) - (a.score ?? 0));
          return filtered.slice(0, maxResults);
        }

        if (enrichedResults.length) {
          enrichedResults.sort((a,b)=> (b.score ?? 0) - (a.score ?? 0));
          return enrichedResults.slice(0, maxResults);
        }
        // if parsing succeeded but we couldn't resolve details, fallthrough to fallback behavior
      }

      // parsing failed or no resolvable items — fallback: if user provided a substantive query, use search
      if (query && query.trim().length >= 3) {
        const list = await collegeService.searchColleges(query.trim());
        const enriched = list.slice(0, maxResults).map((c) => {
          const breakdown = this.computePreferenceBreakdown(c, prefWeights, userProfile, questionnaire);
          const score = breakdown.final;
          const breakdownHuman = this.formatBreakdown(breakdown, c);
          const scoreText = this.formatScoreText(score);
          return { college: c, reason: undefined, breakdown, score, breakdownHuman, scoreText } as any;
        });
        if (wantsInState && userProfile?.state) {
          const filtered = enriched.filter((r) => (r.college?.location?.state || '').toString().toLowerCase() === userProfile.state.toString().toLowerCase());
          filtered.sort((a,b)=> (b.score ?? 0) - (a.score ?? 0));
          return filtered.slice(0, maxResults);
        }
        return enriched.slice(0, maxResults);
      }

      const matches = await collegeService.getMatches({});
      let enrichedMatches = matches.slice(0, maxResults).map((c) => {
        const breakdown = this.computePreferenceBreakdown(c, prefWeights, userProfile, questionnaire);
        const score = breakdown.final;
        const breakdownHuman = this.formatBreakdown(breakdown, c);
        const scoreText = this.formatScoreText(score);
        return { college: c, reason: undefined, breakdown, score, breakdownHuman, scoreText } as any;
      });
      if (wantsInState && userProfile?.state) {
        const filtered = enrichedMatches.filter((r) => (r.college?.location?.state || '').toString().toLowerCase() === userProfile.state.toString().toLowerCase());
        filtered.sort((a,b)=> (b.score ?? 0) - (a.score ?? 0));
        return filtered.slice(0, maxResults);
      }
      return enrichedMatches.slice(0, maxResults);
    } catch (err) {
      const prefWeights = this.buildPreferenceWeights(userProfile, questionnaire, query);
      const matches = await collegeService.getMatches({});
      let enrichedMatches = matches.slice(0, maxResults).map((c) => {
        const breakdown = this.computePreferenceBreakdown(c, prefWeights, userProfile, questionnaire);
        return { college: c, reason: undefined, breakdown, score: breakdown.final } as any;
      });
      if (wantsInState && userProfile?.state) {
        const filtered = enrichedMatches.filter((r) => (r.college?.location?.state || '').toString().toLowerCase() === userProfile.state.toString().toLowerCase());
        filtered.sort((a,b)=> (b.score ?? 0) - (a.score ?? 0));
        return filtered.slice(0, maxResults);
      }
      return enrichedMatches.slice(0, maxResults);
    }
  }
}

export const aiService = new AIService();
