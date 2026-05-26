import { localStorageService } from "@/services/storage/local-storage.service";

import { isStubMode } from '@/services/app/config';
import { aiGatewayService } from '@/services/ai/ai-gateway.service';
import { AI_LAST_ROADMAP_KEY, DEFAULT_ROADMAP_TASKS } from '@/services/ai/ai.constants';
import type { UserProfile } from '@/services/ai/ai.types';
import { errorLoggingService } from '@/services/logging/error-logging.service';

export class AiRoadmapGenerationService {
  async generateRoadmap(userProfile?: UserProfile | null): Promise<string[]> {
    if (isStubMode()) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      return DEFAULT_ROADMAP_TASKS;
    }

    try {
      const gateway = await aiGatewayService.generateRoadmap(userProfile ?? null);
      const tasks = Array.isArray(gateway.tasks)
        ? gateway.tasks.map((task) => String(task ?? '').trim()).filter(Boolean).slice(0, 6)
        : [];
      const normalizedTasks = tasks.length ? tasks : DEFAULT_ROADMAP_TASKS;

      await localStorageService.setItem(AI_LAST_ROADMAP_KEY, JSON.stringify(normalizedTasks));
      return normalizedTasks;
    } catch (error) {
      const cached = await localStorageService.getItem(AI_LAST_ROADMAP_KEY);
      if (cached) {
        void errorLoggingService.captureException(error, {
          category: 'ai',
          operation: 'generate-roadmap',
          severity: 'warn',
          handled: true,
          source: 'ai.service',
          metadata: {
            hasCachedRoadmap: true,
            hasUserProfile: !!userProfile,
          },
        });
        return JSON.parse(cached) as string[];
      }
      void errorLoggingService.captureException(error, {
        category: 'ai',
        operation: 'generate-roadmap',
        severity: 'error',
        handled: false,
        source: 'ai.service',
        metadata: {
          hasCachedRoadmap: false,
          hasUserProfile: !!userProfile,
        },
      });
      throw error;
    }
  }
}
