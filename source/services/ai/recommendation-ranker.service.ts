import { CollegeScoringService } from '@/services/ai/college-scoring.service';
import type { DisabledInfluenceKey, DisabledInfluences, MajorEvidenceLevel, RecommendCollegesOptions, RecommendDebug, RecommendResponse, RecommendResult } from '@/services/ai/ai.types';
import { collegeService } from '@/services/colleges/college.service';
import { errorLoggingService } from '@/services/logging/error-logging.service';

export class CollegeRecommendationRanker extends CollegeScoringService {
  private lastRecommendDebug: RecommendDebug | null = null;

  getLastRecommendDebug(): RecommendDebug | null {
    return this.lastRecommendDebug;
  }

  async recommendColleges(options: RecommendCollegesOptions = {}): Promise<RecommendResponse> {
    const { query = '', userProfile = null, questionnaire = null, maxResults = 12, useWeightedSearch = false, disableAiComponent = false, disabledInfluences = {} } = options;
    const trimmedQuery = query.trim();
    const disabledInfluenceKeys: DisabledInfluenceKey[] = ['gpa', 'prestige', 'major', 'preference', 'query', 'ai'];
    const isInfluenceDisabled = (k: DisabledInfluenceKey) => disabledInfluences[k] === true;

    if (!useWeightedSearch) {
      if (trimmedQuery.length < 2) {
        const response: RecommendResponse = {
          results: [],
          emptyState: {
            code: 'QUERY_NO_RESULTS',
            title: 'Enter a college name',
            message: 'Please enter at least 2 characters to search colleges by name.',
          },
        };
        this.lastRecommendDebug = {
          timestamp: new Date().toISOString(),
          mode: 'search',
          query: trimmedQuery,
          useWeightedSearch,
          emptyState: response.emptyState,
          counts: { fetched: 0, filtered: 0, deterministic: 0, aiCandidates: 0, returned: 0 },
          notes: ['Search mode rejected query with fewer than 2 characters.'],
        };
        return response;
      }
      const raw = await collegeService.searchColleges(trimmedQuery);
      const response: RecommendResponse = {
        results: raw.slice(0, maxResults).map((college) => ({ college, reason: 'Search result', score: 50, scoreText: 'N/A' })),
      };
      this.lastRecommendDebug = {
        timestamp: new Date().toISOString(),
        mode: 'search',
        query: trimmedQuery,
        useWeightedSearch,
        disabledInfluences,
        collegeSource: collegeService.getLastSource(),
        counts: {
          fetched: raw.length,
          filtered: raw.length,
          deterministic: raw.length,
          aiCandidates: 0,
          returned: response.results.length,
        },
        topResults: response.results.slice(0, 10).map((r, idx) => ({
          rank: idx + 1,
          id: String(r.college.id),
          name: r.college.name,
          state: String(r.college.location?.state ?? ''),
          score: Number(r.score ?? 50),
          finalBaseScore: 50,
          aiFactor: 50,
          queryMatch: null,
          reason: r.reason,
        })),
        notes: ['Search mode (non-weighted) uses direct name matching from collegeService.searchColleges.'],
      };
      return response;
    }

    const normalizedQuestionnaire = this.normalizeQuestionnaire(questionnaire);
    const inferredMajor = !String(userProfile?.major ?? '').trim() ? this.inferMajorFromQuery(trimmedQuery) : null;
    const scoringUserProfile = inferredMajor ? { ...(userProfile ?? {}), major: inferredMajor } : userProfile;
    const { gpa, valid: hasValidGpa } = this.parseGpa(userProfile);
    const weight = this.rankImportanceAdjustments(normalizedQuestionnaire);
    const continueEducation = String(normalizedQuestionnaire.continueEducation ?? 'maybe');
    const transferIntentExplicit = this.detectTransferIntentExplicit(trimmedQuery, normalizedQuestionnaire);
    const keepVocational = this.queryExplicitlyRequestsVocational(trimmedQuery);

    const rawUserState = String(userProfile?.state ?? '').trim();
    const locationPref = String(normalizedQuestionnaire.location ?? '').trim();
    const explicitInStatePreference = normalizedQuestionnaire.inStateOutOfState === 'in_state';
    const explicitOutOfStatePreference = normalizedQuestionnaire.inStateOutOfState === 'out_of_state';
    const locationRequestsWashington = this.locationPreferenceRequestsWashington(locationPref);
    const guestWantsWashington =
      !!userProfile?.isGuest &&
      (
        normalizedQuestionnaire.inStateOutOfState === 'no_preference' ||
        locationRequestsWashington
      );
    const signedInMissingStateWantsWashington =
      !userProfile?.isGuest &&
      !rawUserState &&
      !explicitOutOfStatePreference &&
      locationRequestsWashington;
    const wantsInState = explicitInStatePreference || guestWantsWashington || signedInMissingStateWantsWashington;
    const signedInHomeStateSoftBoost =
      !userProfile?.isGuest &&
      !!rawUserState &&
      !wantsInState &&
      normalizedQuestionnaire.inStateOutOfState === 'no_preference';
    const usedWashingtonFallback = !userProfile?.isGuest && !rawUserState;
    const effectiveState = userProfile?.isGuest ? 'Washington' : (rawUserState || 'Washington');
    const stateApiFilter = wantsInState ? this.toStateAbbreviation(effectiveState) : '';
    let usedBroadFetchFallback = false;

    let colleges = await collegeService.getMatches(wantsInState ? { location: stateApiFilter } : {});
    if (wantsInState && colleges.length === 0) {
      usedBroadFetchFallback = true;
      colleges = await collegeService.getMatches({});
    }
    const filtered = wantsInState ? colleges.filter((c) => this.stateMatches(c.location?.state, effectiveState)) : colleges;
    const afterVocationalFilter = keepVocational
      ? filtered
      : filtered.filter((c) => !this.isVocationalInstitutionName(c.name));
    const rankingPool = afterVocationalFilter.length > 0 ? afterVocationalFilter : filtered;
    const vocationalExcludedCount = Math.max(0, filtered.length - rankingPool.length);
    const collegeSource = collegeService.getLastSource();
    const ENRICH_LIMIT = 25;
    let enrichedCount = 0;
    let scoringPool = rankingPool;
    try {
      const subset = rankingPool.slice(0, ENRICH_LIMIT);
      const enrichedSubset = await Promise.all(
        subset.map(async (college) => {
          try {
            const details = await collegeService.getCollegeDetails(String(college.id));
            enrichedCount += 1;
            return details;
          } catch (error) {
            void errorLoggingService.captureException(error, {
              category: 'ai',
              operation: 'recommend-college-detail-enrichment',
              severity: 'warn',
              handled: true,
              source: 'ai.service',
              metadata: {
                collegeId: college.id,
                collegeName: college.name,
              },
            });
            return college;
          }
        })
      );
      const enrichedMap = new Map(enrichedSubset.map((c) => [String(c.id), c]));
      scoringPool = rankingPool.map((c) => enrichedMap.get(String(c.id)) ?? c);
    } catch (error) {
      void errorLoggingService.captureException(error, {
        category: 'ai',
        operation: 'recommend-college-detail-enrichment',
        severity: 'warn',
        handled: true,
        source: 'ai.service',
        metadata: {
          attempted: Math.min(rankingPool.length, ENRICH_LIMIT),
        },
      });
      scoringPool = rankingPool;
    }
    const strictAcademicQueryActive = this.isStrictAcademicQuery(trimmedQuery) && !keepVocational;
    const academicFilteredPool = strictAcademicQueryActive
      ? scoringPool.filter((c) => this.matchesAcademicQuery(c, trimmedQuery, inferredMajor ?? scoringUserProfile?.major))
      : scoringPool;
    const academicFilterApplied = strictAcademicQueryActive && academicFilteredPool.length >= 1;
    const academicExcludedCount = Math.max(0, scoringPool.length - academicFilteredPool.length);
    const finalScoringPool = academicFilterApplied ? academicFilteredPool : scoringPool;

    if (wantsInState && finalScoringPool.length === 0) {
      const response: RecommendResponse = {
        results: [],
        emptyState: {
          code: 'IN_STATE_NO_MATCHES',
          title: 'No in-state matches',
          message: `No matching colleges found in ${effectiveState}.`,
        },
      };
      this.lastRecommendDebug = {
        timestamp: new Date().toISOString(),
        mode: 'weighted',
        query: trimmedQuery,
        useWeightedSearch,
        userProfile: {
          isGuest: !!scoringUserProfile?.isGuest,
          major: scoringUserProfile?.major ?? null,
          gpa: userProfile?.gpa ?? null,
          state: userProfile?.state ?? null,
        },
        normalizedQuestionnaire,
        wantsInState,
        rawUserState,
        effectiveState,
        usedWashingtonFallback,
        collegeSource,
        counts: {
          fetched: colleges.length,
          filtered: finalScoringPool.length,
          deterministic: 0,
          aiCandidates: 0,
          returned: 0,
        },
        emptyState: response.emptyState,
        notes: [
          'In-state filter produced zero candidates.',
          usedBroadFetchFallback
            ? `State-scoped fetch returned 0 for "${stateApiFilter}", then broad fetch fallback also produced no in-state matches.`
            : `State-scoped fetch returned candidates, but none matched "${effectiveState}" after normalization.`,
          keepVocational
            ? 'Vocational filter bypassed because query explicitly requested vocational/trade institutions.'
            : `Vocational-name filter excluded ${vocationalExcludedCount} institutions.`,
          `Candidate enrichment attempted for up to ${ENRICH_LIMIT} schools; successful detail fetches: ${enrichedCount}.`,
          strictAcademicQueryActive
            ? academicFilterApplied
              ? `Strict academic query filter applied; excluded ${academicExcludedCount} candidates.`
              : `Strict academic query filter skipped (only ${academicFilteredPool.length} matches; threshold is 1).`
            : 'Strict academic query filter not active.',
        ],
      };
      return response;
    }

    const deterministic = finalScoringPool.map((college) => {
      const { gpaFitScore, prestigeScore, shouldApplyCap } = this.computeGpaAndPrestige(college, gpa, hasValidGpa);
      const majorEvidence = this.computeMajorEvidence(college, scoringUserProfile?.major);
      const majorFit = majorEvidence.fit;
      const majorEvidenceCount = majorEvidence.evidenceCount;
      const majorEvidenceLevel = majorEvidence.evidenceLevel;
      const waMrpParticipant = majorEvidence.waMrpParticipant;
      const majorPointsNudge = strictAcademicQueryActive ? Math.round(majorEvidence.majorPoints * 0.25) : 0;
      const { preferenceFit, costFit, aidFit, debtFit, costPrefActive } = this.computePreferenceFit(college, normalizedQuestionnaire);
      const institutionLevel = this.inferInstitutionLevel(college);
      const institutionFit = this.institutionPreferenceAdjustment(institutionLevel, continueEducation, transferIntentExplicit);
      const csPathFit = this.csPathAdjustment(institutionLevel, scoringUserProfile?.major, transferIntentExplicit);
      const homeStateBoost = signedInHomeStateSoftBoost && this.stateMatches(college.location?.state, rawUserState) ? 4 : 0;
      const completionScore = Math.round((this.normalizeRate(this.toNumber(college.completionRate)) ?? 0.5) * 100);
      const completionNudge = Math.round((completionScore - 50) * 0.04); // about -2..+2
      const aidDebtNudge = Math.round((((aidFit + debtFit) / 2) - 50) * 0.04); // about -2..+2
      const costNudge = costPrefActive ? Math.round((costFit - 50) * 0.16) : 0; // about -8..+8

      const gpaTerm = isInfluenceDisabled('gpa') ? 50 : gpaFitScore;
      const prestigeTerm = isInfluenceDisabled('prestige') ? 50 : prestigeScore;
      const majorTerm = isInfluenceDisabled('major') ? 50 : majorFit;
      const preferenceTerm = isInfluenceDisabled('preference') ? 50 : preferenceFit;

      let finalBaseScore = Math.round(
        gpaTerm * weight.gpaWeight +
        prestigeTerm * weight.prestigeWeight +
        majorTerm * weight.majorWeight +
        preferenceTerm * weight.preferenceWeight
      );
      // Small tie-breaker so schools with stronger program evidence surface first.
      finalBaseScore += Math.min(4, Math.floor(majorEvidenceCount / 2));
      if (strictAcademicQueryActive) {
        finalBaseScore += Math.min(3, Math.floor(majorEvidenceCount / 6));
      }
      finalBaseScore += majorPointsNudge;
      finalBaseScore += homeStateBoost;
      finalBaseScore += completionNudge + aidDebtNudge + costNudge;
      finalBaseScore += institutionFit + csPathFit;
      finalBaseScore = this.clamp(finalBaseScore);
      if (shouldApplyCap && gpaFitScore < 40) finalBaseScore = Math.min(finalBaseScore, 65);

      return {
        college,
        gpaFitScore,
        prestigeScore,
        majorFit,
        preferenceFit,
        costFit,
        debtFit,
        aidFit,
        institutionFit,
        csPathFit,
        homeStateBoost,
        completionScore,
        completionNudge,
        aidDebtNudge,
        costNudge,
        majorEvidenceCount,
        majorEvidenceLevel,
        waMrpParticipant,
        majorPointsNudge,
        institutionLevel,
        finalBaseScore,
      };
    }).sort((a, b) => b.finalBaseScore - a.finalBaseScore);

    const aiCandidates = deterministic.slice(0, 20);
    const aiComponentDisabled = disableAiComponent || isInfluenceDisabled('ai');
    const aiFactors = aiComponentDisabled
      ? Object.fromEntries(aiCandidates.map((c) => [c.college.id, 50]))
      : await this.computeAiFactors(aiCandidates, scoringUserProfile, normalizedQuestionnaire, trimmedQuery);

    const finalRanked = deterministic
      .map((item) => {
        const aiFactor = this.clamp(aiFactors[item.college.id] ?? 50);
        const queryActive = trimmedQuery.length >= 2;
        const queryMatch = queryActive ? this.computeQueryMatchScore(item.college, trimmedQuery) : null;
        const queryBoost = isInfluenceDisabled('query')
          ? 0
          : this.computeQueryBoost(
              queryMatch,
              item.majorFit,
              strictAcademicQueryActive,
              item.majorEvidenceLevel,
              scoringUserProfile?.major ?? inferredMajor ?? null
            );
        const homeStateFinalBoost =
          signedInHomeStateSoftBoost && this.stateMatches(item.college.location?.state, rawUserState) ? 2 : 0;
        const finalScore = this.clamp(Math.round(item.finalBaseScore * 0.9 + aiFactor * 0.1 + queryBoost + homeStateFinalBoost));
        const reasonPairs = [
          ...(isInfluenceDisabled('gpa') ? [] : [['GPA fit', item.gpaFitScore] as [string, number]]),
          ...(isInfluenceDisabled('prestige') ? [] : [['Prestige', item.prestigeScore] as [string, number]]),
          ...(isInfluenceDisabled('major') ? [] : [['Major match', item.majorFit] as [string, number]]),
          ...(isInfluenceDisabled('preference') ? [] : [['Preference fit', item.preferenceFit] as [string, number]]),
          ['Cost fit', item.costFit],
          ['Debt fit', item.debtFit],
          ['Aid fit', item.aidFit],
          ['Completion', item.completionScore],
          ['Institution fit', item.institutionFit],
          ['CS path fit', item.csPathFit],
          ...(isInfluenceDisabled('ai') ? [] : [['AI fit', aiFactor] as [string, number]]),
          ...(!isInfluenceDisabled('query') && queryBoost > 0 && queryMatch !== null ? [['Query match', queryMatch] as [string, number]] : []),
        ].sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 2);

        const fallbackNote = wantsInState && usedWashingtonFallback
          ? 'State fallback applied: Washington.'
          : '';
        const topFactors = `Top factors: ${reasonPairs.map(([k, v]) => `${k} (${v})`).join(', ')}`;
        const reason = fallbackNote ? `${topFactors} ${fallbackNote}` : topFactors;

        return {
          college: item.college,
          score: finalScore,
          scoreText: `${finalScore}/100`,
          reason,
          breakdown: {
            finalScore,
            finalBaseScore: item.finalBaseScore,
            gpaFitScore: item.gpaFitScore,
            prestigeScore: item.prestigeScore,
            majorFit: item.majorFit,
            preferenceFit: item.preferenceFit,
            costFit: item.costFit,
            debtFit: item.debtFit,
            aidFit: item.aidFit,
            majorEvidenceCount: item.majorEvidenceCount,
            majorEvidenceLevel: item.majorEvidenceLevel,
            waMrpParticipant: item.waMrpParticipant ? 1 : 0,
            majorPointsNudge: item.majorPointsNudge,
            institutionFit: item.institutionFit,
            csPathFit: item.csPathFit,
            homeStateBoost: item.homeStateBoost,
            completionScore: item.completionScore,
            completionNudge: item.completionNudge,
            aidDebtNudge: item.aidDebtNudge,
            costNudge: item.costNudge,
            aiFactor,
            ...(queryMatch === null ? {} : { queryMatch }),
            queryBoost,
            homeStateFinalBoost,
            ...(wantsInState && usedWashingtonFallback ? { stateFallbackUsed: 1 } : {}),
          },
        } as RecommendResult;
      })
      .sort((a, b) => {
        if (signedInHomeStateSoftBoost) {
          const aHome = this.stateMatches(a.college?.location?.state, rawUserState) ? 1 : 0;
          const bHome = this.stateMatches(b.college?.location?.state, rawUserState) ? 1 : 0;
          const scoreDiffAbs = Math.abs((b.score ?? 0) - (a.score ?? 0));
          // Stronger no-preference tie-break: if scores are near-tied, prefer home-state schools.
          if (bHome !== aHome && scoreDiffAbs <= 2) return bHome - aHome;
        }

        const scoreDiff = (b.score ?? 0) - (a.score ?? 0);
        if (scoreDiff) return scoreDiff;

        if (signedInHomeStateSoftBoost) {
          const aHome = this.stateMatches(a.college?.location?.state, rawUserState) ? 1 : 0;
          const bHome = this.stateMatches(b.college?.location?.state, rawUserState) ? 1 : 0;
          if (bHome !== aHome) return bHome - aHome;
        }

        if (wantsInState) {
          const aMrp = Number(a.breakdown?.waMrpParticipant ?? 0);
          const bMrp = Number(b.breakdown?.waMrpParticipant ?? 0);
          if (bMrp !== aMrp) return bMrp - aMrp;
        }

        const aComp = this.normalizeRate(this.toNumber(a.college.completionRate)) ?? -1;
        const bComp = this.normalizeRate(this.toNumber(b.college.completionRate)) ?? -1;
        if (bComp !== aComp) return bComp - aComp;

        const aTuition = this.toNumber(a.college?.tuition) ?? Number.MAX_SAFE_INTEGER;
        const bTuition = this.toNumber(b.college?.tuition) ?? Number.MAX_SAFE_INTEGER;
        if (aTuition !== bTuition) return aTuition - bTuition;

        const aAdm = this.normalizeRate(this.toNumber(a.college?.admissionRate)) ?? 1;
        const bAdm = this.normalizeRate(this.toNumber(b.college?.admissionRate)) ?? 1;
        if (aAdm !== bAdm) return aAdm - bAdm;

        return String(a.college?.name ?? '').localeCompare(String(b.college?.name ?? ''));
      })
      .slice(0, maxResults);

    this.lastRecommendDebug = {
      timestamp: new Date().toISOString(),
      mode: 'weighted',
      query: trimmedQuery,
      useWeightedSearch,
      aiComponentUsed: !aiComponentDisabled,
      disabledInfluences,
      userProfile: {
        isGuest: !!scoringUserProfile?.isGuest,
        major: scoringUserProfile?.major ?? null,
        gpa: userProfile?.gpa ?? null,
        state: userProfile?.state ?? null,
      },
      normalizedQuestionnaire,
      wantsInState,
      rawUserState,
      effectiveState,
      usedWashingtonFallback,
      collegeSource,
      counts: {
        fetched: colleges.length,
        filtered: finalScoringPool.length,
        deterministic: deterministic.length,
        aiCandidates: aiCandidates.length,
        returned: finalRanked.length,
      },
      topResults: finalRanked.slice(0, 10).map((r, idx) => {
        const breakdown = r.breakdown;
        const majorEvidenceLevel =
          breakdown?.majorEvidenceLevel === 'A' ||
          breakdown?.majorEvidenceLevel === 'B' ||
          breakdown?.majorEvidenceLevel === 'C' ||
          breakdown?.majorEvidenceLevel === 'D' ||
          breakdown?.majorEvidenceLevel === 'E'
            ? breakdown.majorEvidenceLevel
            : undefined;

        return {
          rank: idx + 1,
          id: String(r.college.id),
          name: r.college.name,
          state: String(r.college.location?.state ?? ''),
          score: Number(r.score ?? 0),
          finalBaseScore: Number(breakdown?.finalBaseScore ?? 0),
          aiFactor: Number(breakdown?.aiFactor ?? 50),
          queryMatch: typeof breakdown?.queryMatch === 'number' ? Number(breakdown.queryMatch) : null,
          majorEvidenceCount: Number(breakdown?.majorEvidenceCount ?? 0),
          majorEvidenceLevel,
          waMrpParticipant: Boolean(breakdown?.waMrpParticipant),
          queryBoost: Number(breakdown?.queryBoost ?? 0),
          reason: r.reason,
        };
      }),
      notes: [
        usedBroadFetchFallback
          ? `State-scoped fetch returned 0 for "${stateApiFilter}", broad fetch fallback was used.`
          : `State-scoped fetch used filter "${stateApiFilter}".`,
        keepVocational
          ? 'Vocational filter bypassed because query explicitly requested vocational/trade institutions.'
          : `Vocational-name filter excluded ${vocationalExcludedCount} institutions.`,
        `Candidate enrichment attempted for up to ${ENRICH_LIMIT} schools; successful detail fetches: ${enrichedCount}.`,
        strictAcademicQueryActive
          ? academicFilterApplied
            ? `Strict academic query filter applied; excluded ${academicExcludedCount} candidates.`
            : `Strict academic query filter skipped (only ${academicFilteredPool.length} matches; threshold is 1).`
          : 'Strict academic query filter not active.',
        aiComponentDisabled ? 'AI component disabled; using neutral AI factor (50).' : 'AI component enabled.',
        disabledInfluenceKeys.some((key) => disabledInfluences[key] === true)
          ? `Advanced search disabled influences: ${disabledInfluenceKeys.filter((key) => disabledInfluences[key] === true).join(', ')}.`
          : 'Advanced search influence overrides not active.',
        `WA MRP pathway boost candidates in ranking pool: ${deterministic.filter((d) => d.waMrpParticipant).length}.`,
        transferIntentExplicit
          ? 'Transfer intent detected from query/questionnaire text; 2-year institutions are preferred.'
          : continueEducation === 'yes'
            ? 'Continue-education preference is yes; 4-year institutions are preferred.'
            : continueEducation === 'no'
              ? 'Continue-education preference is no; 2-year institutions are mildly preferred.'
              : 'No explicit institution-level preference applied.',
        String(scoringUserProfile?.major ?? '').toLowerCase().includes('computer science')
          ? (transferIntentExplicit
              ? 'CS path preference active: transfer intent favors 2-year institutions.'
              : 'CS path preference active: favors 4-year institutions.')
          : 'CS path preference not active.',
        inferredMajor
          ? `Ephemeral major inferred from query: "${inferredMajor}".`
          : 'No ephemeral major inferred from query.',
        signedInMissingStateWantsWashington
          ? 'Signed-in user had no profile state, questionnaire location was WA, so in-state filtering was enabled.'
          : 'No signed-in WA location override applied.',
        signedInHomeStateSoftBoost
          ? `Signed-in no-preference mode: soft home-state boost applied for ${rawUserState}.`
          : 'No signed-in home-state soft boost applied.',
        guestWantsWashington
          ? 'Guest user with no explicit in-state preference: Washington in-state bias applied.'
          : 'Guest WA in-state bias not applied.',
        usedWashingtonFallback
          ? 'Signed-in user had no profile state; Washington fallback was applied.'
          : 'No state fallback used.',
        wantsInState ? 'In-state filtering enabled.' : 'In-state filtering disabled.',
      ],
    };

    return { results: finalRanked };
  }
}
