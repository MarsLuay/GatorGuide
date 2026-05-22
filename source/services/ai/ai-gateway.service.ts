import AsyncStorage from "@react-native-async-storage/async-storage";
import { httpsCallable } from "firebase/functions";
import { API_CONFIG } from "@/services/app/config";
import { errorLoggingService } from "@/services/logging/error-logging.service";
import { functionsClient } from "@/services/firebase/firebase";

const AI_GATEWAY_CLIENT_ID_KEY = "ai:gateway:clientId:v1";

type AiGatewayQuota = {
  scope: "user" | "guest";
  unitsConsumed: number;
  clientLimit: number;
  clientRemaining: number;
  globalLimit: number;
  globalRemaining: number;
  dateKey: string;
};

type AiGatewayUsage = {
  promptTokens?: number;
  candidateTokens?: number;
  totalTokens?: number;
};

type AiGatewayBaseResponse = {
  ok: boolean;
  requestId: string;
  model: string;
  quota: AiGatewayQuota;
  usage?: AiGatewayUsage;
  usedFallback?: boolean;
};

type ChatGatewayResponse = AiGatewayBaseResponse & {
  text: string;
};

type ChatAssistantGatewayExplanation = {
  summary: string;
  collegeExplanations: {
    id?: string | null;
    name?: string | null;
    explanation: string;
  }[];
};

type ChatAssistantGatewayResponse = AiGatewayBaseResponse & {
  text: string;
  outputFormat: string;
  explanation?: ChatAssistantGatewayExplanation;
};

type DocumentExtractionGatewayResponse = AiGatewayBaseResponse & {
  extraction: {
    documentType: string;
    extractedFields: Record<string, unknown>;
    uncertainties: string[];
    confidence: number | null;
  };
};

type RoadmapGatewayResponse = AiGatewayBaseResponse & {
  tasks: string[];
};

type RecommendFactorGatewayResponse = AiGatewayBaseResponse & {
  factors: { id: string; aiFactor: number }[];
};

export type AiGatewayErrorCode =
  | "quota-exceeded"
  | "timeout"
  | "not-configured"
  | "unavailable"
  | "upstream-error";

export class AiGatewayError extends Error {
  code: AiGatewayErrorCode;
  rawCode?: string;
  details?: unknown;

  constructor(code: AiGatewayErrorCode, message: string, rawCode?: string, details?: unknown) {
    super(message);
    this.name = "AiGatewayError";
    this.code = code;
    this.rawCode = rawCode;
    this.details = details;
  }
}

class AiGatewayService {
  private clientIdPromise: Promise<string> | null = null;

  private makeClientId() {
    return `client-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  private async getClientInstanceId() {
    if (!this.clientIdPromise) {
      this.clientIdPromise = (async () => {
        const cached = await AsyncStorage.getItem(AI_GATEWAY_CLIENT_ID_KEY);
        if (cached?.trim()) return cached.trim();
        const next = this.makeClientId();
        await AsyncStorage.setItem(AI_GATEWAY_CLIENT_ID_KEY, next);
        return next;
      })().catch(async () => this.makeClientId());
    }

    return this.clientIdPromise;
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new AiGatewayError("timeout", "AI gateway request timed out."));
      }, timeoutMs);

      promise
        .then((value) => {
          clearTimeout(timeoutId);
          resolve(value);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  private normalizeError(error: unknown): AiGatewayError {
    if (error instanceof AiGatewayError) return error;

    const errorInfo = error as { code?: unknown; details?: unknown; message?: unknown };
    const rawCode = String(errorInfo.code ?? "");
    const details = errorInfo.details;
    const message =
      String(errorInfo.message ?? "").trim() || "AI gateway request failed.";

    if (rawCode.includes("resource-exhausted")) {
      return new AiGatewayError("quota-exceeded", message, rawCode, details);
    }
    if (rawCode.includes("deadline-exceeded")) {
      return new AiGatewayError("timeout", message, rawCode, details);
    }
    if (rawCode.includes("failed-precondition")) {
      return new AiGatewayError("not-configured", message, rawCode, details);
    }
    if (rawCode.includes("unavailable")) {
      return new AiGatewayError("unavailable", message, rawCode, details);
    }

    return new AiGatewayError("upstream-error", message, rawCode, details);
  }

  private async callGateway<TResponse>(payload: Record<string, unknown>): Promise<TResponse> {
    if (!functionsClient) {
      throw new AiGatewayError("not-configured", "Firebase Functions is not configured for AI requests.");
    }

    try {
      const clientInstanceId = await this.getClientInstanceId();
      const callable = httpsCallable<Record<string, unknown>, TResponse>(
        functionsClient,
        API_CONFIG.ai.gatewayFunctionName
      );
      const result = await this.withTimeout(
        callable({
          clientInstanceId,
          ...payload,
        }).then((response) => response.data),
        API_CONFIG.ai.timeoutMs
      );
      return result;
    } catch (error) {
      const normalized = this.normalizeError(error);
      void errorLoggingService.captureException(normalized, {
        category: "ai",
        operation: "ai-gateway-request",
        severity: "error",
        handled: false,
        source: "ai-gateway.service",
        metadata: {
          action: payload.action ?? "unknown",
          outputFormat: payload.outputFormat ?? null,
          hasContext: payload.context != null,
          collegeCount: Array.isArray(payload.colleges)
            ? payload.colleges.length
            : Array.isArray(payload.topRankedColleges)
              ? payload.topRankedColleges.length
              : 0,
        },
      });
      throw normalized;
    }
  }

  async chat(message: string, context?: string): Promise<ChatGatewayResponse> {
    return this.callGateway<ChatGatewayResponse>({
      action: "chat",
      message,
      context,
    });
  }

  async chatAssistant(input: {
    query: string;
    context?: Record<string, unknown> | string | null;
    topRankedColleges?: Record<string, unknown>[];
    outputFormat?: string;
  }): Promise<ChatAssistantGatewayResponse> {
    return this.callGateway<ChatAssistantGatewayResponse>({
      action: "chatAssistant",
      query: input.query,
      context: input.context ?? {},
      topRankedColleges: input.topRankedColleges ?? [],
      outputFormat: input.outputFormat ?? "text",
    });
  }

  async extractDocumentProfile(input: {
    documentType: string;
    documentMeta?: Record<string, unknown> | null;
    currentProfile?: Record<string, unknown> | null;
    questionnaire?: Record<string, unknown> | null;
    fileBase64: string;
    mimeType: string;
  }): Promise<DocumentExtractionGatewayResponse> {
    return this.callGateway<DocumentExtractionGatewayResponse>({
      action: "documentExtraction",
      documentType: input.documentType,
      documentMeta: input.documentMeta ?? {},
      currentProfile: input.currentProfile ?? {},
      questionnaire: input.questionnaire ?? {},
      fileBase64: input.fileBase64,
      mimeType: input.mimeType,
    });
  }

  async generateRoadmap(userProfile?: Record<string, unknown> | null): Promise<RoadmapGatewayResponse> {
    return this.callGateway<RoadmapGatewayResponse>({
      action: "roadmap",
      userProfile: userProfile ?? {},
    });
  }

  async scoreCollegeFactors(input: {
    userProfile?: Record<string, unknown> | null;
    questionnaire?: Record<string, unknown> | null;
    query?: string;
    colleges: {
      id: string | number;
      name?: string;
      state?: string | null;
      tuition?: number | null;
      setting?: string | null;
      size?: string | null;
      admissionRate?: number | null;
      completionRate?: number | null;
      programs?: string[];
    }[];
  }): Promise<RecommendFactorGatewayResponse> {
    return this.callGateway<RecommendFactorGatewayResponse>({
      action: "recommendFactors",
      userProfile: input.userProfile ?? {},
      questionnaire: input.questionnaire ?? {},
      query: input.query ?? "",
      colleges: input.colleges,
    });
  }
}

export const aiGatewayService = new AiGatewayService();
