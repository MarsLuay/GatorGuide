import { AiAssistantService } from '@/services/ai/assistant.service';
import { CollegeRecommendationRanker } from '@/services/ai/recommendation-ranker.service';
import { AiRoadmapGenerationService } from '@/services/ai/roadmap-generation.service';
import type { AiConversationContext } from '@/services/ai/ai-context.service';
import type { College } from '@/services/colleges/college.service';
import type {
  ChatAssistantInput,
  ChatAssistantResponse,
  ChatMessage,
  PreferenceBreakdown,
  Questionnaire,
  RecommendCollegesOptions,
  RecommendDebug,
  RecommendResponse,
  UserProfile,
} from '@/services/ai/ai.types';

export type {
  ChatAssistantExplanation,
  ChatAssistantInput,
  ChatAssistantOutputFormat,
  ChatAssistantRankedCollege,
  ChatAssistantResponse,
  ChatMessage,
  DisabledInfluenceKey,
  DisabledInfluences,
  EmptyState,
  EmptyStateCode,
  MajorEvidenceLevel,
  PreferenceBreakdown,
  Questionnaire,
  RecommendationBreakdown,
  RecommendCollegesOptions,
  RecommendDebug,
  RecommendResponse,
  RecommendResult,
  UserProfile,
} from '@/services/ai/ai.types';

class AIService {
  private readonly assistant = new AiAssistantService();
  private readonly recommendations = new CollegeRecommendationRanker();
  private readonly roadmap = new AiRoadmapGenerationService();

  getLastRecommendDebug(): RecommendDebug | null {
    return this.recommendations.getLastRecommendDebug();
  }

  chatAssistant(input: ChatAssistantInput): Promise<ChatAssistantResponse> {
    return this.assistant.chatAssistant(input);
  }

  chat(message: string, context?: string | AiConversationContext): Promise<ChatMessage> {
    return this.assistant.chat(message, context);
  }

  generateRoadmap(userProfile?: UserProfile | null): Promise<string[]> {
    return this.roadmap.generateRoadmap(userProfile);
  }

  buildPreferenceWeights(userProfile?: UserProfile | null, questionnaire?: Questionnaire | null, query?: string): Record<string, number> {
    return this.recommendations.buildPreferenceWeights(userProfile, questionnaire, query);
  }

  scoreCollegeAgainstPreferences(
    college: College,
    weights: Record<string, number>,
    userProfile?: UserProfile | null,
    questionnaire?: Questionnaire | null
  ): number {
    return this.recommendations.scoreCollegeAgainstPreferences(college, weights, userProfile, questionnaire);
  }

  computePreferenceBreakdown(
    college: College,
    weights: Record<string, number>,
    userProfile?: UserProfile | null,
    questionnaire?: Questionnaire | null,
    aiFitScore?: number
  ): PreferenceBreakdown {
    return this.recommendations.computePreferenceBreakdown(college, weights, userProfile, questionnaire, aiFitScore);
  }

  recommendColleges(options: RecommendCollegesOptions = {}): Promise<RecommendResponse> {
    return this.recommendations.recommendColleges(options);
  }
}

export const aiService = new AIService();
