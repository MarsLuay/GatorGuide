/**
 * Personalized Timeline port (P02-B): plan milestones, opportunity deadlines,
 * personal deadlines, reminder state.
 */
export interface PersonalizedTimeline {
  project(input: {
    activeTarget: unknown;
    plan: unknown;
    opportunities: unknown[];
    personalDeadlines?: unknown[];
  }): Promise<unknown>;
}
