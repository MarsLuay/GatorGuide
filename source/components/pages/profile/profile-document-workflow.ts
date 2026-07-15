import * as DocumentPicker from "expo-document-picker";
import { Platform } from "react-native";

import { TRANSFER_PLANNER_LEGACY_COMPLETED_COURSES_FIELD } from "@/constants/planner-storage";
import type { QuestionnaireAnswers } from "@/hooks/use-app-data";
import {
  documentReaderService,
  type DocumentExtractionReview,
  type DocumentExtractionReviewItem,
} from "@/services/documents/document-reader.service";
import {
  assertNoTranscriptSourceLeak,
  ingestTranscript,
  type NormalizedTranscriptRecord,
} from "@/services/documents/transcript-ingestor";
import {
  buildTransferPlannerTranscriptCachePatch,
} from "@/services/planning/transfer-planner-cache.service";
import {
  storageService,
  type UploadedFile,
} from "@/services/storage/storage.service";
import {
  omitProfileReviewField,
  omitQuestionnaireReviewField,
} from "@/components/pages/profile/profile-state-utils";

export const PROFILE_TRANSCRIPT_DOCUMENT_PICKER_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export type SelectedProfileDocument = {
  uri: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
  sourceFile?: Blob | null;
};

export function getDocumentPickerSourceFile(asset: DocumentPicker.DocumentPickerAsset) {
  const maybeFile = (asset as DocumentPicker.DocumentPickerAsset & { file?: Blob | null })
    .file;
  return Platform.OS === "web" && typeof Blob !== "undefined" && maybeFile instanceof Blob
    ? maybeFile
    : null;
}

export function buildSelectedProfileDocument(
  asset: DocumentPicker.DocumentPickerAsset,
  fallbackPrefix = "transcript"
): SelectedProfileDocument {
  return {
    uri: asset.uri,
    name: asset.name || asset.uri.split("/").pop() || `${fallbackPrefix}_${Date.now()}`,
    mimeType: asset.mimeType,
    size: asset.size,
    sourceFile: getDocumentPickerSourceFile(asset),
  };
}

export async function pickProfileTranscriptDocument() {
  const result = await DocumentPicker.getDocumentAsync({
    type: [...PROFILE_TRANSCRIPT_DOCUMENT_PICKER_TYPES],
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets?.[0]?.uri) return null;
  return buildSelectedProfileDocument(result.assets[0]);
}

export function prepareTranscriptDocumentReview({
  hideEmpty = true,
  omitCompletedCoursesReview = false,
  removeGpa = false,
  review,
}: {
  hideEmpty?: boolean;
  omitCompletedCoursesReview?: boolean;
  removeGpa?: boolean;
  review: DocumentExtractionReview;
}) {
  let nextReview = omitCompletedCoursesReview
    ? omitQuestionnaireReviewField(
        review,
        TRANSFER_PLANNER_LEGACY_COMPLETED_COURSES_FIELD
      )
    : review;

  if (removeGpa) {
    nextReview = omitProfileReviewField(nextReview, "gpa");
  }

  return !hideEmpty || nextReview.items.length ? nextReview : null;
}

export async function extractProfileTranscriptDocumentReview({
  currentProfile,
  document,
  questionnaireAnswers,
}: {
  currentProfile: {
    major: string;
    gpa: string;
  };
  document: Pick<SelectedProfileDocument, "uri" | "name" | "mimeType" | "size">;
  questionnaireAnswers: QuestionnaireAnswers;
}) {
  const fileName = document.name || document.uri.split("/").pop() || "transcript.pdf";
  const mime = String(document.mimeType || "").toLowerCase();
  const looksPdf =
    mime.includes("pdf") || /\.pdf$/i.test(fileName) || /\.pdf($|\?)/i.test(document.uri);

  // P13-B strangler: deterministic PDF path first; AI document-reader remains fallback.
  if (looksPdf) {
    const ingested = await ingestTranscript({ kind: "uri", uri: document.uri });
    if (ingested.ok && ingested.records.length > 0) {
      const review = buildDeterministicTranscriptReview({
        fileName,
        currentProfile,
        questionnaireAnswers,
        records: ingested.records,
        gpa: ingested.gpa,
        earnedCreditsTotal: ingested.earnedCreditsTotal,
      });
      if (!assertNoTranscriptSourceLeak(review)) {
        throw new Error("transcript review leaked source identity");
      }
      return review;
    }
  }

  return documentReaderService.extractDocumentReview({
    documentType: "transcript",
    fileUri: document.uri,
    fileName,
    mimeType: document.mimeType,
    size: document.size,
    currentProfile,
    questionnaireAnswers,
  });
}

function buildDeterministicTranscriptReview({
  fileName,
  currentProfile,
  questionnaireAnswers,
  records,
  gpa,
  earnedCreditsTotal,
}: {
  fileName: string;
  currentProfile: { major: string; gpa: string };
  questionnaireAnswers: QuestionnaireAnswers;
  records: NormalizedTranscriptRecord[];
  gpa: string | null;
  earnedCreditsTotal: number | null;
}): DocumentExtractionReview {
  const items: DocumentExtractionReviewItem[] = [];
  const userPatch: Record<string, string> = {};
  const questionnairePatch: Record<string, string> = {};
  const courseLines = records
    .map((r) => [r.code, r.title].filter(Boolean).join(" ").trim())
    .filter(Boolean)
    .join("\n");

  if (!String(currentProfile.gpa || "").trim() && gpa) {
    items.push({
      id: "gpa",
      labelKey: "profile.gpa",
      target: "profile",
      currentValue: null,
      suggestedValue: gpa,
      sourceSnippet: null,
      confidence: 1,
    });
    userPatch.gpa = gpa;
  }

  if (courseLines) {
    const currentCourses =
      String(
        questionnaireAnswers[TRANSFER_PLANNER_LEGACY_COMPLETED_COURSES_FIELD] ?? ""
      ).trim() || null;
    items.push({
      id: TRANSFER_PLANNER_LEGACY_COMPLETED_COURSES_FIELD,
      labelKey: "profile.documentReaderFieldCompletedCourses",
      target: "questionnaire",
      currentValue: currentCourses,
      suggestedValue: courseLines,
      sourceSnippet: null,
      confidence: 1,
    });
    questionnairePatch[TRANSFER_PLANNER_LEGACY_COMPLETED_COURSES_FIELD] = courseLines;
  }

  if (earnedCreditsTotal != null && Number.isFinite(earnedCreditsTotal)) {
    const credits = String(earnedCreditsTotal);
    items.push({
      id: "transferCredits",
      labelKey: "profile.documentReaderFieldTransferCredits",
      target: "questionnaire",
      currentValue: String(questionnaireAnswers.transferCredits ?? "").trim() || null,
      suggestedValue: credits,
      sourceSnippet: null,
      confidence: 1,
    });
    questionnairePatch.transferCredits = credits;
  }

  return {
    documentType: "transcript",
    fileName,
    items,
    userPatch,
    questionnairePatch,
    uncertainties: [],
    confidence: 1,
  };
}

export async function uploadProfileTranscriptDocument(
  userId: string,
  selectedDoc: SelectedProfileDocument | null
): Promise<UploadedFile | null> {
  if (!selectedDoc?.uri) return null;
  return storageService.uploadTranscript(userId, selectedDoc.uri, {
    fileName: selectedDoc.name,
    mimeType: selectedDoc.mimeType,
    sizeBytes: selectedDoc.size,
    sourceFile: selectedDoc.sourceFile,
  });
}

export async function syncUploadedTranscriptToPlanner({
  applyTranscriptGpa,
  setQuestionnaireAnswers,
  uploaded,
}: {
  applyTranscriptGpa: (
    rawGpa: string | null | undefined,
    operation: string
  ) => Promise<boolean>;
  setQuestionnaireAnswers: (
    answers:
      | QuestionnaireAnswers
      | ((currentAnswers: QuestionnaireAnswers) => QuestionnaireAnswers)
  ) => Promise<void>;
  uploaded: UploadedFile;
}) {
  const ingested = await ingestTranscript({ kind: "uri", uri: uploaded.url });
  if (!ingested.ok) {
    throw new Error(ingested.error || "transcript ingest failed");
  }
  if (!assertNoTranscriptSourceLeak(ingested)) {
    throw new Error("transcript ingest leaked source identity");
  }

  if (ingested.records.length) {
    await setQuestionnaireAnswers((currentAnswers) => ({
      ...currentAnswers,
      ...buildTransferPlannerTranscriptCachePatch(
        uploaded,
        ingested.records.map((record) => ({
          code: record.code,
          title: record.title,
          label: [record.code, record.title].filter(Boolean).join(" ").trim(),
          credits: record.credits,
          grade: record.grade,
          gradeValue: null,
          termLabel: record.termLabel,
          termStartDate: record.termStartDate,
          termEndDate: record.termEndDate,
          catalogYearLabel: record.catalogYearLabel,
        })),
        ingested.earnedCreditsTotal
      ),
    }));
  }

  await applyTranscriptGpa(ingested.gpa, "auto-apply-transcript-pdf-gpa");

  return ingested.records.length;
}

/**
 * Soft P14: Living Plan + plannerV2 replace AI roadmap bootstrap after profile setup.
 * Kept as a no-op so callers/tests compile; hard delete lands with roadmap.service retirement.
 */
export async function ensureProfileSetupRoadmap(_args: {
  gpa: string;
  major: string;
  questionnaireAnswers: QuestionnaireAnswers;
  savedCollegeNames: string[];
  transcriptFileName?: string | null;
  userId: string;
}): Promise<void> {
  return;
}
