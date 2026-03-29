import { httpsCallable } from "firebase/functions";
import { API_CONFIG } from "./config";
import { errorLoggingService } from "./error-logging.service";
import { functionsClient } from "./firebase";

type OpportunityGatewayBaseResponse = {
  ok: boolean;
  requestId: string;
};

type SeedGreenRiverResponse = OpportunityGatewayBaseResponse & {
  seeded: boolean;
  opportunityId: string;
};

type UpsertCollegeDeadlineResponse = OpportunityGatewayBaseResponse & {
  opportunityId: string;
  deadlineSourceUrl: string | null;
  deadlineDueAt: string | null;
};

export class OpportunityGatewayError extends Error {
  rawCode?: string;
  details?: unknown;

  constructor(message: string, rawCode?: string, details?: unknown) {
    super(message);
    this.name = "OpportunityGatewayError";
    this.rawCode = rawCode;
    this.details = details;
  }
}

class OpportunityGatewayService {
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new OpportunityGatewayError("Opportunity gateway request timed out."));
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

  private normalizeError(error: unknown) {
    if (error instanceof OpportunityGatewayError) return error;
    return new OpportunityGatewayError(
      String((error as any)?.message ?? "Opportunity gateway request failed."),
      String((error as any)?.code ?? ""),
      (error as any)?.details
    );
  }

  private async callGateway<TResponse>(
    payload: Record<string, unknown>
  ): Promise<TResponse> {
    if (!functionsClient) {
      throw new OpportunityGatewayError(
        "Firebase Functions is not configured for opportunity requests."
      );
    }

    try {
      const callable = httpsCallable<Record<string, unknown>, TResponse>(
        functionsClient,
        API_CONFIG.opportunities.gatewayFunctionName
      );
      return await this.withTimeout(
        callable(payload).then((response) => response.data),
        API_CONFIG.opportunities.timeoutMs
      );
    } catch (error) {
      const normalized = this.normalizeError(error);
      void errorLoggingService.captureException(normalized, {
        category: "sync",
        operation: "opportunity-gateway-request",
        severity: "warn",
        handled: false,
        source: "opportunity-gateway.service",
        metadata: {
          action: payload.action ?? "unknown",
        },
      });
      throw normalized;
    }
  }

  async seedGreenRiverFoundationScholarship() {
    return this.callGateway<SeedGreenRiverResponse>({
      action: "seedGreenRiverFoundationScholarship",
    });
  }

  async upsertCollegeDeadlineOpportunity(input: {
    collegeId?: string | null;
    collegeName?: string | null;
    collegeWebsite?: string | null;
  }) {
    return this.callGateway<UpsertCollegeDeadlineResponse>({
      action: "upsertCollegeDeadlineOpportunity",
      collegeId: input.collegeId ?? null,
      collegeName: input.collegeName ?? null,
      collegeWebsite: input.collegeWebsite ?? null,
    });
  }
}

export const opportunityGatewayService = new OpportunityGatewayService();
