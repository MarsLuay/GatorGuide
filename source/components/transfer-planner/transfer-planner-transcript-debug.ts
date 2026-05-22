
import { transcriptPlannerDebugService } from "@/services/dev/transcript-planner-debug.service";
import { TRANSCRIPT_PARSER_VERSION } from "@/services/planning/transfer-planner-cache.service";
import type { TranscriptCourseEntry } from "@/services/planning/transfer-planner.service";

import type { TranscriptDocument } from "./transfer-planner-storage";

type Translate = (key: string, params?: Record<string, string | number>) => string;

export function getTranscriptDocumentIdentity(document: TranscriptDocument | null | undefined) {
  if (!document?.url) return "";
  return `${document.url}|${document.uploadedAt ?? ""}`;
}

export function getTranscriptAnalysisAttemptKey(document: TranscriptDocument | null | undefined) {
  const documentIdentity = getTranscriptDocumentIdentity(document);
  return documentIdentity ? `${documentIdentity}|v${TRANSCRIPT_PARSER_VERSION}` : "";
}

export function buildFriendlyTranscriptError(t?: Translate) {
  return t
    ? t("transferPlanner.friendlyTranscriptError")
    : "We couldn't read past classes from this unofficial transcript yet. Upload the PDF directly from ctcLink using the link below.";
}

export function getReadableTranscriptFileName(document: TranscriptDocument | null) {
  const rawName = String(document?.name ?? "").trim();
  if (
    rawName &&
    rawName.length <= 180 &&
    !rawName.startsWith("data:") &&
    !rawName.startsWith("blob:") &&
    !rawName.includes("base64,")
  ) {
    return rawName;
  }

  const rawUrl = String(document?.url ?? "").trim();
  if (rawUrl && !rawUrl.startsWith("data:") && !rawUrl.startsWith("blob:")) {
    const withoutQuery = rawUrl.split(/[?#]/)[0] ?? "";
    const lastSegment = withoutQuery.split("/").pop() ?? "";
    try {
      const decoded = decodeURIComponent(lastSegment).trim();
      if (decoded && decoded.length <= 180) {
        return decoded;
      }
    } catch {
      if (lastSegment.trim() && lastSegment.trim().length <= 180) {
        return lastSegment.trim();
      }
    }
  }

  return "unofficial-transcript.pdf";
}

export function getTranscriptUrlKind(url: string | null | undefined) {
  const raw = String(url ?? "").trim();
  if (!raw) return "missing";
  if (raw.startsWith("data:")) return "data-url";
  if (raw.startsWith("blob:")) return "blob-url";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return "remote-url";
  if (raw.startsWith("file://")) return "file-url";
  if (/^[A-Za-z]:[\\/]/.test(raw)) return "windows-local-path";
  if (raw.startsWith("/")) return "local-path";
  return "other";
}

export function getDebugNowMs() {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

export function getDebugElapsedMs(startMs: number) {
  return Math.round((getDebugNowMs() - startMs) * 10) / 10;
}

export function appendTranscriptDebugEvent(
  label: string,
  startedAtMs: number,
  metadata?: Record<string, unknown>
) {
  transcriptPlannerDebugService.appendTranscriptPlannerEvent({
    label,
    elapsedMs: getDebugElapsedMs(startedAtMs),
    metadata,
  });
}

export function buildParsedCourseAssignmentsPreview(courses: TranscriptCourseEntry[]) {
  return courses.slice(0, 24).map((course) => ({
    code: course.code,
    label: course.label,
    termLabel: course.termLabel ?? null,
    termStartDate: course.termStartDate ?? null,
  }));
}

export function buildParsedQuarterBuckets(courses: TranscriptCourseEntry[]) {
  const grouped = new Map<
    string,
    {
      termLabel: string | null;
      termStartDate: string | null;
      courseCodes: string[];
    }
  >();

  for (const course of courses) {
    const termLabel = String(course.termLabel ?? "").trim() || null;
    const termStartDate = String(course.termStartDate ?? "").trim() || null;
    const groupKey = `${termStartDate ?? ""}|${termLabel ?? ""}`;

    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, {
        termLabel,
        termStartDate,
        courseCodes: [],
      });
    }

    const bucket = grouped.get(groupKey);
    if (!bucket) continue;
    if (!bucket.courseCodes.includes(course.code)) {
      bucket.courseCodes.push(course.code);
    }
  }

  return [...grouped.values()]
    .sort((left, right) =>
      `${left.termStartDate ?? ""}|${left.termLabel ?? ""}`.localeCompare(
        `${right.termStartDate ?? ""}|${right.termLabel ?? ""}`
      )
    )
    .slice(0, 12);
}

export function buildTranscriptDebugSnapshot({
  phase,
  document,
  parserVersion,
  storedParserVersion,
  transcriptSourceKey,
  storedTranscriptSource,
  completedCoursesBeforeCount,
  questionnaireCompletedCourseCount,
  parsedCourseCount,
  parsedCourseCodesPreview,
  parsedCourseAssignmentsPreview,
  parsedQuarterBuckets,
  timings,
  parserDiagnostics,
  error,
}: {
  phase: "analysis-start" | "analysis-success" | "analysis-failure" | "upload-failure";
  document: TranscriptDocument;
  parserVersion: number;
  storedParserVersion: number | null;
  transcriptSourceKey: string;
  storedTranscriptSource: string;
  completedCoursesBeforeCount: number;
  questionnaireCompletedCourseCount: number;
  parsedCourseCount: number | null;
  parsedCourseCodesPreview: string[];
  parsedCourseAssignmentsPreview?: {
    code: string;
    label: string;
    termLabel: string | null;
    termStartDate: string | null;
  }[];
  parsedQuarterBuckets?: {
    termLabel: string | null;
    termStartDate: string | null;
    courseCodes: string[];
  }[];
  timings?: Record<string, number>;
  parserDiagnostics?: unknown;
  error: unknown;
}) {
  const normalizedError =
    error instanceof Error
      ? {
          name: error.name || "Error",
          message: error.message || "Unexpected transcript error",
          code: String((error as Error & { code?: unknown }).code ?? "").trim() || null,
        }
      : error
        ? {
            name: "Error",
            message: String((error as { message?: unknown })?.message ?? error),
            code: String((error as { code?: unknown })?.code ?? "").trim() || null,
          }
        : null;

  return {
    timestamp: new Date().toISOString(),
    phase,
    document: {
      name: document.name ?? null,
      displayName: getReadableTranscriptFileName(document),
      urlKind: getTranscriptUrlKind(document.url),
      urlLength: String(document.url ?? "").length,
      mimeType: document.mimeType ?? null,
      sizeBytes: document.sizeBytes ?? null,
      uploadedAt: document.uploadedAt || null,
    },
    parserVersion,
    storedParserVersion,
    transcriptSourceKey: transcriptSourceKey || null,
    storedTranscriptSource: storedTranscriptSource || null,
    completedCoursesBeforeCount,
    questionnaireCompletedCourseCount,
    parsedCourseCount,
    parsedCourseCodesPreview,
    parsedCourseAssignmentsPreview: parsedCourseAssignmentsPreview ?? [],
    parsedQuarterBuckets: parsedQuarterBuckets ?? [],
    timings: timings ?? {},
    parserDiagnostics: parserDiagnostics ?? null,
    error: normalizedError,
  };
}
