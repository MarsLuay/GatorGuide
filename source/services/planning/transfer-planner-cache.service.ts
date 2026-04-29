import type { ParsedTranscriptCourse } from "@/services/documents/transcript-pdf.service";
import type { UploadedFile } from "@/services/storage/storage.service";

export const TRANSCRIPT_COURSES_FIELD = "transferPlannerCompletedCourses";
export const TRANSCRIPT_SOURCE_FIELD = "transferPlannerTranscriptSource";
export const TRANSCRIPT_UPLOADED_AT_FIELD = "transferPlannerTranscriptUploadedAt";
export const TRANSCRIPT_PARSER_VERSION_FIELD = "transferPlannerTranscriptParserVersion";
export const TRANSCRIPT_PARSER_VERSION = 2;

const TRANSFER_PLANNER_TRANSCRIPT_CACHE_FIELDS = [
  TRANSCRIPT_COURSES_FIELD,
  TRANSCRIPT_SOURCE_FIELD,
  TRANSCRIPT_UPLOADED_AT_FIELD,
  TRANSCRIPT_PARSER_VERSION_FIELD,
] as const;

export function clearTransferPlannerTranscriptCache(
  questionnaireAnswers: Record<string, unknown> | null | undefined
) {
  const nextQuestionnaireAnswers: Record<string, unknown> = {
    ...(questionnaireAnswers ?? {}),
  };

  delete nextQuestionnaireAnswers["completedCourses"];

  for (const field of TRANSFER_PLANNER_TRANSCRIPT_CACHE_FIELDS) {
    delete nextQuestionnaireAnswers[field];
  }

  return nextQuestionnaireAnswers;
}

export function buildTransferPlannerTranscriptCachePatch(
  document: Pick<UploadedFile, "url" | "uploadedAt">,
  completedCourses: ParsedTranscriptCourse[]
) {
  return {
    [TRANSCRIPT_COURSES_FIELD]: completedCourses,
    completedCourses: completedCourses.map((course) => course.label),
    [TRANSCRIPT_SOURCE_FIELD]: document.url,
    [TRANSCRIPT_PARSER_VERSION_FIELD]: TRANSCRIPT_PARSER_VERSION,
    [TRANSCRIPT_UPLOADED_AT_FIELD]: document.uploadedAt || new Date().toISOString(),
  };
}
