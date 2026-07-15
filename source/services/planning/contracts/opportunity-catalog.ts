/**
 * Opportunity Catalog port (P02-B): deterministic relevance + completion workflow.
 * Unknown attributes never exclude; missing matching data falls back to all.
 */
export interface OpportunityCatalog {
  listRelevant(input: {
    studentAttributes: Record<string, unknown>;
  }): Promise<unknown[]>;
  markComplete(input: {
    ownerId: string;
    opportunityId: string;
    complete: boolean;
  }): Promise<void>;
}
