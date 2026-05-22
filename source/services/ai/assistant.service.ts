import AsyncStorage from '@react-native-async-storage/async-storage';

import { isStubMode } from '@/services/app/config';
import { errorLoggingService } from '@/services/logging/error-logging.service';
import { aiGatewayService } from '@/services/ai/ai-gateway.service';
import { serializeAiConversationContext, type AiConversationCollegeSummary, type AiConversationContext } from '@/services/ai/ai-context.service';
import type { College } from '@/services/colleges/college.service';
import {
  AI_ASSISTANT_MAX_PROGRAMS,
  AI_ASSISTANT_MAX_RANKED_COLLEGES,
  AI_LAST_ASSISTANT_RESPONSE_KEY,
  AI_LAST_ASSISTANT_RESPONSE_MAP_KEY,
  AI_LAST_RESPONSE_KEY,
  AI_LAST_RESPONSE_MAP_KEY,
} from '@/services/ai/ai.constants';
import type {
  ChatAssistantExplanation,
  ChatAssistantInput,
  ChatAssistantOutputFormat,
  ChatAssistantRankedCollege,
  ChatAssistantResponse,
  ChatMessage,
  RecommendResult,
} from '@/services/ai/ai.types';

export class AiAssistantService {
  private parseNullableNumber(value: unknown) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  private serializeChatContext(context?: string | AiConversationContext | null) {
    if (!context) return '';
    if (typeof context === 'string') return context.trim();
    return serializeAiConversationContext(context);
  }

  private normalizeAssistantCollege(
    item: RecommendResult | College | AiConversationCollegeSummary | ChatAssistantRankedCollege
  ): ChatAssistantRankedCollege | null {
    if (!item) return null;

    if ('college' in item && item.college) {
      const college = item.college;
      return {
        id: String(college.id ?? ''),
        name: this.truncateText(college.name, 160) || 'Unknown College',
        location: {
          city: this.truncateText(college.location?.city, 120) || null,
          state: this.truncateText(college.location?.state, 80) || null,
        },
        matchScore: this.parseNullableNumber(college.matchScore),
        score: this.parseNullableNumber(item.score),
        scoreText: this.truncateText(item.scoreText, 80) || null,
        reason: this.truncateText(item.reason, 220) || null,
        tuition: this.parseNullableNumber(college.tuition),
        tuitionInState: this.parseNullableNumber(college.tuitionInState),
        tuitionOutOfState: this.parseNullableNumber(college.tuitionOutOfState),
        avgNetPriceOverall: this.parseNullableNumber(college.avgNetPriceOverall),
        admissionRate: this.parseNullableNumber(college.admissionRate),
        completionRate: this.parseNullableNumber(college.completionRate),
        pellGrantRate: this.parseNullableNumber(college.pellGrantRate),
        medianDebtCompletersOverall: this.parseNullableNumber(college.medianDebtCompletersOverall),
        size: this.truncateText(college.size, 40) || null,
        setting: this.truncateText(college.setting, 40) || null,
        locale: this.truncateText(college.locale, 80) || null,
        programs: Array.isArray(college.programs)
          ? college.programs.map((program) => this.truncateText(program, 120)).filter(Boolean).slice(0, AI_ASSISTANT_MAX_PROGRAMS)
          : [],
      };
    }

    const college = item as College | AiConversationCollegeSummary | ChatAssistantRankedCollege;
    return {
      id: String(college.id ?? ''),
      name: this.truncateText(college.name, 160) || 'Unknown College',
      location: {
        city: this.truncateText(college.location?.city, 120) || null,
        state: this.truncateText(college.location?.state, 80) || null,
      },
      matchScore: this.parseNullableNumber(college.matchScore),
      score: 'score' in college ? this.parseNullableNumber((college as ChatAssistantRankedCollege).score) : null,
      scoreText: 'scoreText' in college ? this.truncateText((college as ChatAssistantRankedCollege).scoreText, 80) || null : null,
      reason: 'reason' in college ? this.truncateText((college as ChatAssistantRankedCollege).reason, 220) || null : null,
      tuition: this.parseNullableNumber(college.tuition),
      tuitionInState: this.parseNullableNumber(college.tuitionInState),
      tuitionOutOfState: this.parseNullableNumber(college.tuitionOutOfState),
      avgNetPriceOverall: this.parseNullableNumber(college.avgNetPriceOverall),
      admissionRate: this.parseNullableNumber(college.admissionRate),
      completionRate: this.parseNullableNumber(college.completionRate),
      pellGrantRate: this.parseNullableNumber(college.pellGrantRate),
      medianDebtCompletersOverall: this.parseNullableNumber(college.medianDebtCompletersOverall),
      size: this.truncateText(college.size, 40) || null,
      setting: this.truncateText(college.setting, 40) || null,
      locale: this.truncateText(college.locale, 80) || null,
      programs: Array.isArray(college.programs)
        ? college.programs.map((program) => this.truncateText(program, 120)).filter(Boolean).slice(0, AI_ASSISTANT_MAX_PROGRAMS)
        : [],
    };
  }

  private pickAssistantTopRankedColleges(
    topRankedColleges?: (RecommendResult | College | AiConversationCollegeSummary | ChatAssistantRankedCollege)[],
    context?: AiConversationContext | string | null,
  ) {
    const direct = Array.isArray(topRankedColleges) ? topRankedColleges : [];
    const contextColleges =
      !direct.length && context && typeof context !== 'string'
        ? (context.topMatches?.length ? context.topMatches : context.savedColleges)
        : [];

    return [...direct, ...contextColleges]
      .map((item) => this.normalizeAssistantCollege(item))
      .filter((item): item is ChatAssistantRankedCollege => !!item?.id)
      .slice(0, AI_ASSISTANT_MAX_RANKED_COLLEGES);
  }

  private buildAssistantExplanationFallback(topRankedColleges: ChatAssistantRankedCollege[]): ChatAssistantExplanation {
    const collegeExplanations = topRankedColleges.slice(0, AI_ASSISTANT_MAX_RANKED_COLLEGES).map((college) => {
      const fitSignals = [
        college.reason,
        college.matchScore !== null ? `match score ${Math.round(college.matchScore)}/100` : '',
        college.avgNetPriceOverall !== null ? `average net price ${college.avgNetPriceOverall}` : '',
        college.completionRate !== null ? `completion rate ${college.completionRate}` : '',
      ].filter(Boolean);

      return {
        id: college.id,
        name: college.name,
        explanation: fitSignals.length
          ? `${college.name} stands out because of ${fitSignals.join(', ')}.`
          : `${college.name} appears to fit the current profile and saved preferences.`,
      };
    });

    return {
      summary: collegeExplanations.length
        ? 'These colleges fit best based on the current profile, questionnaire answers, and ranked college data.'
        : "I can explain why colleges fit once ranked colleges are available in the request or the saved context.",
      collegeExplanations,
    };
  }

  private coerceAssistantExplanation(
    explanation: unknown,
    topRankedColleges: ChatAssistantRankedCollege[],
  ): ChatAssistantExplanation {
    const fallback = this.buildAssistantExplanationFallback(topRankedColleges);
    const summary = this.truncateText((explanation as ChatAssistantExplanation | null)?.summary, 1200) || fallback.summary;
    const rawItems = Array.isArray((explanation as ChatAssistantExplanation | null)?.collegeExplanations)
      ? (explanation as ChatAssistantExplanation).collegeExplanations
      : [];

    const collegeExplanations = rawItems
      .map((item, index) => {
        const fallbackItem = fallback.collegeExplanations[index];
        const name = this.truncateText(item?.name, 160) || fallbackItem?.name || null;
        const explanationText = this.truncateText(item?.explanation, 500) || fallbackItem?.explanation || null;
        if (!name || !explanationText) return null;
        return {
          id: this.truncateText(item?.id, 64) || fallbackItem?.id || null,
          name,
          explanation: explanationText,
        };
      })
      .filter(Boolean) as { id: string | null; name: string; explanation: string }[];

    return {
      summary,
      collegeExplanations: collegeExplanations.length ? collegeExplanations : fallback.collegeExplanations,
    };
  }

  private buildAssistantTextFallback(topRankedColleges: ChatAssistantRankedCollege[]) {
    if (!topRankedColleges.length) {
      return "I'm here to help with transfer planning, college comparisons, costs, deadlines, and next steps. Ask about a school, a transfer requirement, or what to do next.";
    }

    const shortlist = topRankedColleges
      .slice(0, 3)
      .map((college) => (college.reason ? `${college.name} (${college.reason})` : college.name))
      .join('; ');

    return `Based on your current profile and saved data, strong colleges to review next are ${shortlist}. Verify deadlines, transfer policies, and costs on each college's official website before deciding.`;
  }

  private makeAssistantCacheSignature(input: {
    query: string;
    outputFormat: ChatAssistantOutputFormat;
    context?: AiConversationContext | string | null;
    topRankedColleges: ChatAssistantRankedCollege[];
  }) {
    return this.stableStringify({
      query: String(input.query ?? '').trim(),
      outputFormat: input.outputFormat,
      context: this.serializeChatContext(input.context),
      topRankedColleges: input.topRankedColleges,
    });
  }

  async chatAssistant(input: ChatAssistantInput): Promise<ChatAssistantResponse> {
    const query = String(input.query ?? '').trim();
    if (!query) {
      throw new Error('Assistant query is required.');
    }

    const outputFormat: ChatAssistantOutputFormat = input.outputFormat ?? 'text';
    const topRankedColleges = this.pickAssistantTopRankedColleges(input.topRankedColleges, input.context);
    const cacheSignature = this.makeAssistantCacheSignature({
      query,
      outputFormat,
      context: input.context,
      topRankedColleges,
    });

    if (isStubMode()) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      const explanation =
        outputFormat === 'recommendation_explanations_json'
          ? this.buildAssistantExplanationFallback(topRankedColleges)
          : null;

      return {
        message: {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content:
            outputFormat === 'recommendation_explanations_json'
              ? explanation?.summary || this.buildAssistantTextFallback(topRankedColleges)
              : this.getStubResponse(query),
          timestamp: new Date().toISOString(),
          source: 'stub',
        },
        outputFormat,
        explanation,
      };
    }

    try {
      const gateway = await aiGatewayService.chatAssistant({
        query,
        context: typeof input.context === 'string' ? this.serializeChatContext(input.context) : input.context ?? {},
        topRankedColleges,
        outputFormat,
      });

      const explanation =
        outputFormat === 'recommendation_explanations_json'
          ? this.coerceAssistantExplanation(gateway.explanation, topRankedColleges)
          : null;

      const payload: ChatAssistantResponse = {
        message: {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content:
            String(gateway.text ?? '').trim() ||
            explanation?.summary ||
            this.buildAssistantTextFallback(topRankedColleges),
          timestamp: new Date().toISOString(),
          source: 'live',
        },
        outputFormat,
        explanation,
      };

      try {
        const raw = await AsyncStorage.getItem(AI_LAST_ASSISTANT_RESPONSE_MAP_KEY);
        const map = raw ? JSON.parse(raw) as Record<string, ChatAssistantResponse> : {};
        map[cacheSignature] = payload;
        const MAX_CACHED_RESPONSES = 50;
        const entries = Object.entries(map).sort(
          (a, b) => new Date(a[1].message.timestamp).getTime() - new Date(b[1].message.timestamp).getTime()
        );
        while (entries.length > MAX_CACHED_RESPONSES) {
          const [oldKey] = entries.shift()!;
          delete map[oldKey];
        }
        await AsyncStorage.setItem(AI_LAST_ASSISTANT_RESPONSE_MAP_KEY, JSON.stringify(map));
      } catch (cacheError) {
        void errorLoggingService.captureException(cacheError, {
          category: 'ai',
          operation: 'chat-assistant-cache-write',
          severity: 'warn',
          handled: true,
          source: 'ai.service',
          metadata: {
            cache: 'response-map',
            outputFormat,
            collegeCount: topRankedColleges.length,
            hasContext: !!input.context,
          },
        });
      }

      try {
        await AsyncStorage.setItem(AI_LAST_ASSISTANT_RESPONSE_KEY, JSON.stringify(payload));
      } catch (cacheError) {
        void errorLoggingService.captureException(cacheError, {
          category: 'ai',
          operation: 'chat-assistant-cache-write',
          severity: 'warn',
          handled: true,
          source: 'ai.service',
          metadata: {
            cache: 'last-response',
            outputFormat,
            collegeCount: topRankedColleges.length,
            hasContext: !!input.context,
          },
        });
      }

      return payload;
    } catch (error) {
      const baseMetadata = {
        outputFormat,
        queryLength: query.length,
        topRankedCollegeCount: topRankedColleges.length,
      };

      try {
        const raw = await AsyncStorage.getItem(AI_LAST_ASSISTANT_RESPONSE_MAP_KEY);
        const map = raw ? JSON.parse(raw) as Record<string, ChatAssistantResponse> : {};
        const cached = map && map[cacheSignature];
        if (cached?.message) {
          void errorLoggingService.captureException(error, {
            category: 'ai',
            operation: 'chat-assistant',
            severity: 'warn',
            handled: true,
            source: 'ai.service',
            metadata: {
              ...baseMetadata,
              fallback: 'cached',
            },
          });
          return {
            ...cached,
            message: {
              ...cached.message,
              id: `msg-${Date.now()}`,
              source: 'cached',
            },
          };
        }
      } catch (cacheError) {
        void errorLoggingService.captureException(cacheError, {
          category: 'ai',
          operation: 'chat-assistant-cache-read',
          severity: 'warn',
          handled: true,
          source: 'ai.service',
          metadata: {
            ...baseMetadata,
            fallback: 'cached',
          },
        });
      }

      try {
        const rawLast = await AsyncStorage.getItem(AI_LAST_ASSISTANT_RESPONSE_KEY);
        if (rawLast) {
          const parsed = JSON.parse(rawLast) as ChatAssistantResponse;
          if (parsed?.message) {
            void errorLoggingService.captureException(error, {
              category: 'ai',
              operation: 'chat-assistant',
              severity: 'warn',
              handled: true,
              source: 'ai.service',
              metadata: {
                ...baseMetadata,
                fallback: 'cached-stale',
              },
            });
            return {
              ...parsed,
              message: {
                ...parsed.message,
                id: `msg-${Date.now()}`,
                source: 'cached-stale',
                content: `[Stale cached response — may not match your new question]\n\n${parsed.message.content}`,
              },
            };
          }
        }
      } catch (cacheError) {
        void errorLoggingService.captureException(cacheError, {
          category: 'ai',
          operation: 'chat-assistant-cache-read',
          severity: 'warn',
          handled: true,
          source: 'ai.service',
          metadata: {
            ...baseMetadata,
            fallback: 'cached-stale',
          },
        });
      }

      void errorLoggingService.captureException(error, {
        category: 'ai',
        operation: 'chat-assistant',
        severity: 'error',
        handled: false,
        source: 'ai.service',
        metadata: {
          ...baseMetadata,
          fallback: 'none',
        },
      });
      throw error;
    }
  }

  async chat(message: string, context?: string | AiConversationContext): Promise<ChatMessage> {
    const serializedContext = this.serializeChatContext(context);

    if (isStubMode()) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      return {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: this.getStubResponse(message),
        timestamp: new Date().toISOString(),
        source: 'stub',
      };
    }

    try {
      const gateway = await aiGatewayService.chat(message, serializedContext);
      const text =
        String(gateway.text ?? '').trim() ||
        "I'm here to help with your college journey. What would you like to know?";

      const payload: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: text,
        timestamp: new Date().toISOString(),
        source: 'live',
      };

      // Cache by request signature so stale replies from other prompts are not reused.
      const sig = this.makeCacheSignature(message, serializedContext);
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
      } catch (cacheError) {
        void errorLoggingService.captureException(cacheError, {
          category: 'ai',
          operation: 'chat-cache-write',
          severity: 'warn',
          handled: true,
          source: 'ai.service',
          metadata: {
            cache: 'response-map',
            queryLength: message.length,
            hasContext: !!serializedContext,
          },
        });
      }

      // Keep a global fallback response for offline/error recovery.
      try {
        await AsyncStorage.setItem(AI_LAST_RESPONSE_KEY, JSON.stringify(payload));
      } catch (cacheError) {
        void errorLoggingService.captureException(cacheError, {
          category: 'ai',
          operation: 'chat-cache-write',
          severity: 'warn',
          handled: true,
          source: 'ai.service',
          metadata: {
            cache: 'last-response',
            queryLength: message.length,
            hasContext: !!serializedContext,
          },
        });
      }
      return payload;
    } catch (error) {
      const baseMetadata = {
        queryLength: message.length,
        hasContext: !!serializedContext,
      };
      const sig = this.makeCacheSignature(message, serializedContext);
      try {
        const raw = await AsyncStorage.getItem(AI_LAST_RESPONSE_MAP_KEY);
        const map = raw ? JSON.parse(raw) as Record<string, ChatMessage> : {};
        const cached = map && map[sig];
        if (cached) {
          void errorLoggingService.captureException(error, {
            category: 'ai',
            operation: 'chat',
            severity: 'warn',
            handled: true,
            source: 'ai.service',
            metadata: {
              ...baseMetadata,
              fallback: 'cached',
            },
          });
          return { ...cached, id: `msg-${Date.now()}`, source: 'cached' };
        }
      } catch (cacheError) {
        void errorLoggingService.captureException(cacheError, {
          category: 'ai',
          operation: 'chat-cache-read',
          severity: 'warn',
          handled: true,
          source: 'ai.service',
          metadata: {
            ...baseMetadata,
            fallback: 'cached',
          },
        });
      }

      try {
        const rawLast = await AsyncStorage.getItem(AI_LAST_RESPONSE_KEY);
        if (rawLast) {
          const parsed = JSON.parse(rawLast) as ChatMessage;
          void errorLoggingService.captureException(error, {
            category: 'ai',
            operation: 'chat',
            severity: 'warn',
            handled: true,
            source: 'ai.service',
            metadata: {
              ...baseMetadata,
              fallback: 'cached-stale',
            },
          });
          return { ...parsed, id: `msg-${Date.now()}`, source: 'cached-stale', content: `[Stale cached response — may not match your new question]\n\n${parsed.content}` };
        }
      } catch (cacheError) {
        void errorLoggingService.captureException(cacheError, {
          category: 'ai',
          operation: 'chat-cache-read',
          severity: 'warn',
          handled: true,
          source: 'ai.service',
          metadata: {
            ...baseMetadata,
            fallback: 'cached-stale',
          },
        });
      }

      void errorLoggingService.captureException(error, {
        category: 'ai',
        operation: 'chat',
        severity: 'error',
        handled: false,
        source: 'ai.service',
        metadata: {
          ...baseMetadata,
          fallback: 'none',
        },
      });
      throw error;
    }
  }

  // thin wrapper so tests and other methods can compute the same cache signature
  private makeCacheSignature(message: string, context?: string | AiConversationContext) {
    const serializedContext = this.serializeChatContext(context);
    return JSON.stringify({ message: message ?? '', context: serializedContext });
  }

  private stableStringify(input: unknown): string {
    if (input === null || typeof input !== 'object') return JSON.stringify(input);
    if (Array.isArray(input)) return `[${input.map((v) => this.stableStringify(v)).join(',')}]`;
    const record = input as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${this.stableStringify(record[k])}`).join(',')}}`;
  }

  private truncateText(input: unknown, max = 300) {
    const text = String(input ?? '');
    return text.length > max ? `${text.slice(0, max)}…` : text;
  }

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
}
