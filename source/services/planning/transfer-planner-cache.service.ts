const TRANSCRIPT_COURSES_FIELD = "transferPlannerCompletedCourses";
const TRANSCRIPT_SOURCE_FIELD = "transferPlannerTranscriptSource";
const TRANSCRIPT_UPLOADED_AT_FIELD = "transferPlannerTranscriptUploadedAt";
const TRANSCRIPT_PARSER_VERSION_FIELD = "transferPlannerTranscriptParserVersion";

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
