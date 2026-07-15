/**
 * Living Plan Engine port (P02-B): schedule through transfer with move/lock later.
 */
export interface LivingPlanConstraints {
  targetCampusId: string;
  targetProgramId: string;
  transferQuarter?: string;
  lockedCourseInstanceIds?: string[];
}

export interface LivingPlanEngine {
  buildPlan(input: {
    studentRecord: unknown;
    constraints: LivingPlanConstraints;
  }): Promise<unknown>;
  recalculate(input: {
    plan: unknown;
    studentRecord: unknown;
    constraints: LivingPlanConstraints;
  }): Promise<unknown>;
}
