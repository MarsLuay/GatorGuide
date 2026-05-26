import * as DocumentPicker from "expo-document-picker";
import { Platform } from "react-native";

import { TRANSFER_PLANNER_LEGACY_COMPLETED_COURSES_FIELD } from "@/constants/planner-storage";
import type { QuestionnaireAnswers } from "@/hooks/use-app-data";
import {
  documentReaderService,
  type DocumentExtractionReview,
} from "@/services/documents/document-reader.service";
import { transcriptPdfService } from "@/services/documents/transcript-pdf.service";
import { roadmapService } from "@/services/planning/roadmap.service";
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
  return documentReaderService.extractDocumentReview({
    documentType: "transcript",
    fileUri: document.uri,
    fileName: document.name || document.uri.split("/").pop() || "transcript.pdf",
    mimeType: document.mimeType,
    size: document.size,
    currentProfile,
    questionnaireAnswers,
  });
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
  const parsedTranscript = await transcriptPdfService.extractTranscriptDataFromPdf(
    uploaded.url
  );

  if (parsedTranscript.completedCourses.length) {
    await setQuestionnaireAnswers((currentAnswers) => ({
      ...currentAnswers,
      ...buildTransferPlannerTranscriptCachePatch(
        uploaded,
        parsedTranscript.completedCourses,
        parsedTranscript.earnedCreditsTotal
      ),
    }));
  }

  await applyTranscriptGpa(
    parsedTranscript.gpa,
    "auto-apply-transcript-pdf-gpa"
  );

  return parsedTranscript.completedCourses.length;
}

export async function ensureProfileSetupRoadmap({
  gpa,
  major,
  questionnaireAnswers,
  savedCollegeNames,
  transcriptFileName,
  userId,
}: {
  gpa: string;
  major: string;
  questionnaireAnswers: QuestionnaireAnswers;
  savedCollegeNames: string[];
  transcriptFileName?: string | null;
  userId: string;
}) {
  await roadmapService.ensureUserRoadmap(userId, {
    major,
    gpa,
    questionnaireAnswers,
    targetSchools: savedCollegeNames,
    documents: {
      ...(transcriptFileName
        ? {
            transcripts: {
              fileName: transcriptFileName,
            },
          }
        : {}),
    },
  });
}
