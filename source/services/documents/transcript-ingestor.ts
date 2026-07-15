/**
 * P13-B TranscriptIngestor strangler — deterministic parse + guaranteed source disposal.
 * Does not yet replace document-reader call sites; Profile can migrate callers later.
 */

import {
  transcriptPdfService,
  type ParsedTranscriptCourse,
  type ParsedTranscriptData,
} from "@/services/documents/transcript-pdf.service";

export type TranscriptSource =
  | { kind: "uri"; uri: string }
  | { kind: "blob"; blob: Blob; dispose?: () => void | Promise<void> }
  | { kind: "bytes"; bytes: Uint8Array; label?: string };

export type NormalizedTranscriptRecord = {
  code: string;
  title: string;
  credits: number | null;
  grade: string | null;
  termLabel: string | null;
  termStartDate: string | null;
  termEndDate: string | null;
  catalogYearLabel: string | null;
};

export type TranscriptIngestResult =
  | {
      ok: true;
      records: NormalizedTranscriptRecord[];
      gpa: string | null;
      earnedCreditsTotal: number | null;
    }
  | {
      ok: false;
      error: string;
    };

function toNormalized(course: ParsedTranscriptCourse): NormalizedTranscriptRecord {
  return {
    code: course.code,
    title: course.title,
    credits: course.credits,
    grade: course.grade,
    termLabel: course.termLabel,
    termEndDate: course.termEndDate,
    termStartDate: course.termStartDate,
    catalogYearLabel: course.catalogYearLabel,
  };
}

async function disposeSource(source: TranscriptSource): Promise<void> {
  if (source.kind === "blob" && typeof source.dispose === "function") {
    await source.dispose();
  }
  // URI / bytes: callers own temp files; we never persist originals here.
}

async function parseSource(source: TranscriptSource): Promise<ParsedTranscriptData> {
  if (source.kind === "uri") {
    return transcriptPdfService.extractTranscriptDataFromPdf(source.uri);
  }
  if (source.kind === "blob") {
    const buffer = await source.blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    // transcript-pdf expects a URI today; web blob path uses a temporary object URL.
    const objectUrl = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    try {
      return await transcriptPdfService.extractTranscriptDataFromPdf(objectUrl);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }
  throw new Error("bytes source requires URI adapter; use kind uri or blob");
}

/**
 * Always disposes the source in `finally`, on success and failure.
 * Never returns original filename/path/blob/data URL in the result.
 */
export async function ingestTranscript(
  source: TranscriptSource
): Promise<TranscriptIngestResult> {
  try {
    const parsed = await parseSource(source);
    return {
      ok: true,
      records: (parsed.completedCourses || []).map(toNormalized),
      gpa: parsed.gpa,
      earnedCreditsTotal: parsed.earnedCreditsTotal,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await disposeSource(source);
  }
}

/** Privacy gate: payloads must not include source identity. */
export function assertNoTranscriptSourceLeak(payload: unknown): boolean {
  const text = JSON.stringify(payload ?? {});
  const banned = [
    /data:application\/pdf;base64,/i,
    /"transcriptUri"/i,
    /"originalFilename"/i,
    /file:\/\/\//i,
    /content:\/\//i,
  ];
  return !banned.some((re) => re.test(text));
}
