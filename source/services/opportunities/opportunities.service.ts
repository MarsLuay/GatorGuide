import { localStorageService } from "@/services/storage/local-storage.service";
import { collection, getDocs } from "firebase/firestore";
import {
  type Opportunity,
  normalizeOpportunity,
  normalizeOpportunityDate,
  OPPORTUNITY_STATUSES,
} from "@/constants/opportunities";
import { STARTER_OPPORTUNITIES } from "@/constants/starter-opportunities";
import { FIRESTORE_COLLECTIONS } from "@/constants/schema";
import { db } from "@/services/firebase/firebase";
import { LOCAL_STORAGE_KEYS } from "@/services/storage/local-storage-contracts";
import { opportunityGatewayService } from "./opportunity-gateway.service";

type OpportunityCatalogCachePayload = {
  schemaVersion: number;
  fetchedAt: string;
  opportunities: Opportunity[];
};

export type OpportunityCatalogResult = {
  opportunities: Opportunity[];
  source: "cache" | "live";
  fetchedAt: string | null;
};

const OPPORTUNITY_CATALOG_SCHEMA_VERSION = 1;

function sortOpportunities(opportunities: Opportunity[]) {
  return [...opportunities].sort((left, right) => {
    const leftDue = normalizeOpportunityDate(left.dueAt) ?? "9999-12-31T00:00:00.000Z";
    const rightDue = normalizeOpportunityDate(right.dueAt) ?? "9999-12-31T00:00:00.000Z";
    if (leftDue !== rightDue) return leftDue.localeCompare(rightDue);
    return left.title.localeCompare(right.title);
  });
}

function mergeOpportunityCatalogs(
  base: Opportunity[],
  incoming: Opportunity[]
): Opportunity[] {
  const merged = new Map<string, Opportunity>();

  for (const opportunity of base ?? []) {
    merged.set(opportunity.opportunityId, normalizeOpportunity(opportunity));
  }

  for (const opportunity of incoming ?? []) {
    merged.set(opportunity.opportunityId, normalizeOpportunity(opportunity));
  }

  return sortOpportunities(Array.from(merged.values()));
}

class OpportunitiesService {
  private catalogStorageKey = LOCAL_STORAGE_KEYS.opportunitiesCatalog;
  private starterCatalog = sortOpportunities(
    STARTER_OPPORTUNITIES.map((opportunity) => normalizeOpportunity(opportunity))
  );

  async readCatalogCache(): Promise<OpportunityCatalogCachePayload | null> {
    try {
      const raw = await localStorageService.getItem(this.catalogStorageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as OpportunityCatalogCachePayload;
      if (!Array.isArray(parsed?.opportunities)) return null;
      return {
        schemaVersion:
          Number(parsed.schemaVersion) || OPPORTUNITY_CATALOG_SCHEMA_VERSION,
        fetchedAt:
          normalizeOpportunityDate(parsed.fetchedAt) ?? new Date().toISOString(),
        opportunities: mergeOpportunityCatalogs(
          this.starterCatalog,
          parsed.opportunities.map((opportunity) =>
            normalizeOpportunity(opportunity)
          )
        ),
      };
    } catch {
      return null;
    }
  }

  async writeCatalogCache(opportunities: Opportunity[]) {
    const payload: OpportunityCatalogCachePayload = {
      schemaVersion: OPPORTUNITY_CATALOG_SCHEMA_VERSION,
      fetchedAt: new Date().toISOString(),
      opportunities: mergeOpportunityCatalogs(this.starterCatalog, opportunities),
    };
    await localStorageService.setItem(this.catalogStorageKey, JSON.stringify(payload));
  }

  async getCatalogFromFirestore(): Promise<Opportunity[]> {
    if (!db) return this.starterCatalog;

    const snapshot = await getDocs(collection(db, FIRESTORE_COLLECTIONS.opportunities));
    return mergeOpportunityCatalogs(
      this.starterCatalog,
      snapshot.docs
        .map((item) =>
          normalizeOpportunity({
            opportunityId: item.id,
            ...(item.data() as Partial<Opportunity>),
          })
        )
        .filter((opportunity) => opportunity.opportunityId)
    );
  }

  async loadCatalog(options: { preferCache?: boolean } = {}): Promise<OpportunityCatalogResult> {
    const preferCache = options.preferCache ?? true;
    const cached = await this.readCatalogCache();
    if (preferCache && cached?.opportunities?.length) {
      return {
        opportunities: cached.opportunities,
        source: "cache",
        fetchedAt: cached.fetchedAt,
      };
    }

    if (!db) {
      return {
        opportunities: cached?.opportunities ?? this.starterCatalog,
        source: cached ? "cache" : "live",
        fetchedAt: cached?.fetchedAt ?? null,
      };
    }

    const opportunities = await this.getCatalogFromFirestore();
    await this.writeCatalogCache(opportunities);

    return {
      opportunities,
      source: "live",
      fetchedAt: new Date().toISOString(),
    };
  }

  async refreshCatalog(): Promise<OpportunityCatalogResult> {
    try {
      const opportunities = await this.getCatalogFromFirestore();
      await this.writeCatalogCache(opportunities);
      return {
        opportunities,
        source: "live",
        fetchedAt: new Date().toISOString(),
      };
    } catch {
      const cached = await this.readCatalogCache();
      return {
        opportunities: cached?.opportunities ?? this.starterCatalog,
        source: "cache",
        fetchedAt: cached?.fetchedAt ?? null,
      };
    }
  }

  filterActiveCatalog(opportunities: Opportunity[]) {
    return sortOpportunities(
      (opportunities ?? []).filter(
        (opportunity) => opportunity.status !== OPPORTUNITY_STATUSES.archived
      )
    );
  }

  findOpportunityById(opportunities: Opportunity[], opportunityId: string) {
    return (opportunities ?? []).find(
      (opportunity) => opportunity.opportunityId === opportunityId
    );
  }

  findCollegeDeadlineOpportunity(
    opportunities: Opportunity[],
    collegeId: string | null | undefined
  ) {
    const normalizedCollegeId = String(collegeId ?? "").trim();
    if (!normalizedCollegeId) return null;
    return (
      (opportunities ?? []).find(
        (opportunity) =>
          opportunity.type === "college_deadline" &&
          opportunity.college.collegeId === normalizedCollegeId
      ) ?? null
    );
  }

  async ensureGreenRiverFoundationScholarshipSeeded() {
    if (!db) return null;
    await opportunityGatewayService.seedGreenRiverFoundationScholarship();
    return this.refreshCatalog();
  }

  async ensureCollegeDeadlineOpportunity(input: {
    collegeId?: string | null;
    collegeName?: string | null;
    collegeWebsite?: string | null;
  }) {
    if (!db) return null;
    await opportunityGatewayService.upsertCollegeDeadlineOpportunity(input);
    return this.refreshCatalog();
  }
}

export const opportunitiesService = new OpportunitiesService();
