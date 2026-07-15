/**
 * Student Record port (P02-B): normalized transcript-derived courses,
 * active target, constraints, progress, persistence/sync policy.
 */
export interface StudentRecordRepository {
  load(ownerId: string): Promise<unknown>;
  save(ownerId: string, record: unknown): Promise<void>;
  applyTranscriptCourses(ownerId: string, courses: unknown[]): Promise<unknown>;
}
