import { httpsCallable } from "firebase/functions";
import { API_CONFIG } from "./config";
import { errorLoggingService } from "./error-logging.service";
import { functionsClient } from "./firebase";

type OpportunityGatewayBaseResponse = {
  ok: boolean;
  requestId: string;
};

export type OpportunityAdminAccessResponse = OpportunityGatewayBaseResponse & {
  authorized: boolean;
  authorizedBy: "email" | "uid" | null;
  email: string | null;
  allowedEmailsConfigured: boolean;
  allowedUidsConfigured: boolean;
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

export type UpsertManualOpportunityInput = {
  opportunityId?: string | null;
  type: string;
  status: string;
  title: string;
  organizationName: string;
  summary: string;
  externalUrl?: string | null;
  dueDate?: string | null;
  isYearly?: boolean;
  timezone?: string | null;
  deadlineType?: string | null;
  deadlineLabel?: string | null;
  financialAidTags?: string[];
  suggestedMajors?: string[];
  hasToBeMajor?: boolean;
  gpaMin?: number | null;
  residencyTypes?: string[];
  transferOnly?: boolean;
  recommendationCountMin?: number | null;
  essayCount?: number | null;
  awardAmountMin?: number | null;
  awardAmountMax?: number | null;
  awardCurrency?: string | null;
  awardAmountText?: string | null;
  awardRenewable?: boolean | null;
  collegeId?: string | null;
  collegeName?: string | null;
  collegeCity?: string | null;
  collegeState?: string | null;
  collegeWebsite?: string | null;
  sourceUrl?: string | null;
  sourceLabel?: string | null;
};

export type UpsertManualOpportunityResponse = OpportunityGatewayBaseResponse & {
  opportunityId: string;
  created: boolean;
  status: string;
};

export type ArchiveOpportunityResponse = OpportunityGatewayBaseResponse & {
  opportunityId: string;
  status: string;
};

export type DeleteOpportunityResponse = OpportunityGatewayBaseResponse & {
  opportunityId: string;
  deleted: boolean;
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

  async getOpportunityAdminAccess() {
    return this.callGateway<OpportunityAdminAccessResponse>({
      action: "getOpportunityAdminAccess",
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

  async upsertManualOpportunity(input: UpsertManualOpportunityInput) {
    return this.callGateway<UpsertManualOpportunityResponse>({
      action: "upsertManualOpportunity",
      ...input,
    });
  }

  async archiveOpportunity(opportunityId: string, archived: boolean = true) {
    return this.callGateway<ArchiveOpportunityResponse>({
      action: "archiveOpportunity",
      opportunityId,
      archived,
    });
  }

  async deleteOpportunity(opportunityId: string) {
    return this.callGateway<DeleteOpportunityResponse>({
      action: "deleteOpportunity",
      opportunityId,
    });
  }
}

export const opportunityGatewayService = new OpportunityGatewayService();
