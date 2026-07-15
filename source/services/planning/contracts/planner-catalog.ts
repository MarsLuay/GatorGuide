/**
 * Planner Catalog port (P02-B): validated catalog-year-aware courses,
 * equivalencies, pathways, and requirements for runtime callers.
 */
export type CatalogYear = string;

export interface PlannerCatalogCourseRef {
  code: string;
  subject?: string;
  catalogYear?: CatalogYear;
}

export interface PlannerCatalog {
  getRequirementSet(input: {
    campusId: string;
    programId: string;
    catalogYear: CatalogYear;
  }): Promise<unknown>;
  getEquivalencies(input: {
    uwCourseCodes: string[];
    catalogYear: CatalogYear;
  }): Promise<unknown>;
  getPathwayOptions(input: {
    campusId: string;
    programId: string;
    catalogYear: CatalogYear;
  }): Promise<unknown>;
}
