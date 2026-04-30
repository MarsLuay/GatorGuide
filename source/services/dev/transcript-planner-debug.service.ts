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
  parserVersion: number | null;
  storedParserVersion: number | null;
  transcriptSourceKey: string | null;
  storedTranscriptSource: string | null;
  completedCoursesBeforeCount: number;
  questionnaireCompletedCourseCount: number;
  parsedCourseCount: number | null;
  parsedCourseCodesPreview: string[];
  parsedCourseAssignmentsPreview: {
    code: string;
    label: string;
    termLabel: string | null;
    termStartDate: string | null;
  }[];
  parsedQuarterBuckets: {
    termLabel: string | null;
    termStartDate: string | null;
    courseCodes: string[];
  }[];
  timings?: Record<string, number>;
  parserDiagnostics?: unknown;
  error:
    | {
        name: string | null;
        message: string;
        code: string | null;
      }
    | null;
};

export type TranscriptPlannerDebugEvent = {
  timestamp: string;
  label: string;
  elapsedMs?: number | null;
  metadata?: Record<string, unknown>;
};

class TranscriptPlannerDebugService {
  private lastTranscriptPlannerDebug: TranscriptPlannerDebugSnapshot | null = null;
  private recentTranscriptPlannerEvents: TranscriptPlannerDebugEvent[] = [];

  getLastTranscriptPlannerDebug() {
    return this.lastTranscriptPlannerDebug;
  }

  getRecentTranscriptPlannerEvents() {
    return this.recentTranscriptPlannerEvents;
  }

  setLastTranscriptPlannerDebug(snapshot: TranscriptPlannerDebugSnapshot | null) {
    this.lastTranscriptPlannerDebug = snapshot;
  }

  appendTranscriptPlannerEvent(event: Omit<TranscriptPlannerDebugEvent, "timestamp">) {
    this.recentTranscriptPlannerEvents = [
      ...this.recentTranscriptPlannerEvents.slice(-79),
      {
        timestamp: new Date().toISOString(),
        ...event,
      },
    ];
  }

  clearTranscriptPlannerEvents() {
    this.recentTranscriptPlannerEvents = [];
  }
}

export const transcriptPlannerDebugService = new TranscriptPlannerDebugService();
