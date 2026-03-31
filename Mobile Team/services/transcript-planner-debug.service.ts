export type TranscriptPlannerDebugSnapshot = {
  timestamp: string;
  phase:
    | "analysis-start"
    | "analysis-success"
    | "analysis-failure"
    | "upload-failure";
  document: {
    name: string | null;
    displayName: string | null;
    urlKind: string;
    urlLength: number;
    mimeType: string | null;
    sizeBytes: number | null;
    uploadedAt: string | null;
  };
  transcriptSourceKey: string | null;
  storedTranscriptSource: string | null;
  completedCoursesBeforeCount: number;
  questionnaireCompletedCourseCount: number;
  parsedCourseCount: number | null;
  parsedCourseCodesPreview: string[];
  error:
    | {
        name: string | null;
        message: string;
        code: string | null;
      }
    | null;
};

class TranscriptPlannerDebugService {
  private lastTranscriptPlannerDebug: TranscriptPlannerDebugSnapshot | null = null;

  getLastTranscriptPlannerDebug() {
    return this.lastTranscriptPlannerDebug;
  }

  setLastTranscriptPlannerDebug(snapshot: TranscriptPlannerDebugSnapshot | null) {
    this.lastTranscriptPlannerDebug = snapshot;
  }
}

export const transcriptPlannerDebugService = new TranscriptPlannerDebugService();
