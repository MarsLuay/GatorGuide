import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { aiGatewayService } from '@/services/ai/ai-gateway.service';
import { isStubMode } from '@/services/app/config';

const MAX_INLINE_DOCUMENT_BYTES = 4 * 1024 * 1024;

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  txt: 'text/plain',
  md: 'text/markdown',
  markdown: 'text/markdown',
  html: 'text/html',
  htm: 'text/html',
  xml: 'application/xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

const SUPPORTED_EXTRACTION_MIME_TYPES = new Set<string>([
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/html',
  'application/xml',
  'text/xml',
  'image/png',
  'image/jpeg',
  'image/webp',
]);

export type DocumentReaderType = 'resume' | 'transcript';

type DocumentExtractionFieldValue = {
  value?: unknown;
  sourceSnippet?: string | null;
  confidence?: number | null;
};

export type DocumentExtractionResult = {
  documentType: string;
  extractedFields: {
    gpa?: DocumentExtractionFieldValue;
    major?: DocumentExtractionFieldValue;
    majorSignals?: DocumentExtractionFieldValue;
    completedCourses?: DocumentExtractionFieldValue;
    transferCredits?: DocumentExtractionFieldValue;
    resumeSkills?: DocumentExtractionFieldValue;
  };
  uncertainties: string[];
  confidence: number | null;
};

export type DocumentExtractionReviewItem = {
  id: string;
  labelKey: string;
  target: 'profile' | 'questionnaire';
  currentValue: string | null;
  suggestedValue: string;
  sourceSnippet: string | null;
  confidence: number | null;
};

export type DocumentExtractionReview = {
  documentType: DocumentReaderType;
  fileName: string;
  items: DocumentExtractionReviewItem[];
  userPatch: Record<string, string>;
  questionnairePatch: Record<string, string>;
  uncertainties: string[];
  confidence: number | null;
};

type ExtractDocumentReviewInput = {
  documentType: DocumentReaderType;
  fileUri: string;
  fileName: string;
  mimeType?: string | null;
  size?: number | null;
  currentProfile?: {
    major?: string | null;
    gpa?: string | null;
  } | null;
  questionnaireAnswers?: Record<string, unknown> | null;
};

function cleanText(value: unknown, max = 300) {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, max) : '';
}

function cleanConfidence(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function formatExtractedGpa(value: unknown) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const match = raw.match(/-?\d+(?:\.\d+)?/);
  if (!match) return raw.slice(0, 40);

  const num = Number.parseFloat(match[0]);
  if (!Number.isFinite(num)) return raw.slice(0, 40);

  // Clamp to valid GPA range and truncate (floor) to two decimal places to avoid
  // showing float artifacts like 3.999999 -> 3.99 (don't round up to 4.00).
  const clamped = Math.max(0, Math.min(num, 4.0));
  const truncated = Math.floor(clamped * 100) / 100;

  // Format without unnecessary trailing zeros: 4 -> "4", 3.5 -> "3.5", 3.99 -> "3.99"
  const fixed = truncated.toFixed(2).replace(/\.0+$|0+$/g, '');
  return fixed;
}

function inferMimeType(fileName: string, mimeType?: string | null) {
  const trimmedMime = cleanText(mimeType, 120).toLowerCase();
  if (trimmedMime) return trimmedMime;
  const ext = cleanText(fileName.split('.').pop(), 20).toLowerCase();
  return MIME_BY_EXTENSION[ext] ?? 'application/octet-stream';
}

function isSupportedMimeType(mimeType: string) {
  return SUPPORTED_EXTRACTION_MIME_TYPES.has(mimeType);
}

async function readBlobAsBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result ?? '');
      const [, base64 = ''] = result.split(',', 2);
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read selected document.'));
    reader.readAsDataURL(blob);
  });
}

async function readFileAsBase64(fileUri: string) {
  if (Platform.OS === 'web') {
    const response = await fetch(fileUri);
    const blob = await response.blob();
    return readBlobAsBase64(blob);
  }

  const encodingType = (FileSystem as any).EncodingType?.Base64 ?? 'base64';
  return FileSystem.readAsStringAsync(fileUri, { encoding: encodingType });
}

function stringifyList(value: unknown, separator = ', ') {
  if (!Array.isArray(value)) return cleanText(value, 600);
  return value.map((item) => cleanText(item, 120)).filter(Boolean).join(separator);
}

function normalizeExtractionResult(
  documentType: DocumentReaderType,
  raw: Partial<DocumentExtractionResult> | null | undefined,
): DocumentExtractionResult {
  const extractedFields = raw?.extractedFields ?? {};

  return {
    documentType: cleanText(raw?.documentType, 40) || documentType,
    extractedFields: {
      gpa: extractedFields.gpa,
      major: extractedFields.major,
      majorSignals: extractedFields.majorSignals,
      completedCourses: extractedFields.completedCourses,
      transferCredits: extractedFields.transferCredits,
      resumeSkills: extractedFields.resumeSkills,
    },
    uncertainties: Array.isArray(raw?.uncertainties)
      ? raw!.uncertainties.map((item) => cleanText(item, 220)).filter(Boolean)
      : [],
    confidence: cleanConfidence(raw?.confidence),
  };
}

function buildStubExtraction(documentType: DocumentReaderType): DocumentExtractionResult {
  return {
    documentType,
    extractedFields: {},
    uncertainties: ['Live AI document extraction is only available when the Gemini gateway is configured.'],
    confidence: 0,
  };
}

function addReviewItem(
  reviewItems: DocumentExtractionReviewItem[],
  userPatch: Record<string, string>,
  questionnairePatch: Record<string, string>,
  item: {
    id: string;
    labelKey: string;
    target: 'profile' | 'questionnaire';
    currentValue: string | null;
    suggestedValue: string;
    sourceSnippet?: string | null;
    confidence?: number | null;
  },
) {
  const suggestedValue = cleanText(item.suggestedValue, 800);
  const currentValue = cleanText(item.currentValue, 800);
  if (!suggestedValue) return;
  if (currentValue && currentValue.toLowerCase() === suggestedValue.toLowerCase()) return;

  reviewItems.push({
    id: item.id,
    labelKey: item.labelKey,
    target: item.target,
    currentValue: currentValue || null,
    suggestedValue,
    sourceSnippet: cleanText(item.sourceSnippet, 240) || null,
    confidence: cleanConfidence(item.confidence),
  });

  if (item.target === 'profile') {
    userPatch[item.id] = suggestedValue;
    return;
  }

  questionnairePatch[item.id] = suggestedValue;
}

function buildReview(
  input: ExtractDocumentReviewInput,
  extraction: DocumentExtractionResult,
): DocumentExtractionReview {
  const reviewItems: DocumentExtractionReviewItem[] = [];
  const userPatch: Record<string, string> = {};
  const questionnairePatch: Record<string, string> = {};
  const profile = input.currentProfile ?? {};
  const questionnaire = input.questionnaireAnswers ?? {};

  addReviewItem(reviewItems, userPatch, questionnairePatch, {
    id: 'gpa',
    labelKey: 'profile.gpa',
    target: 'profile',
    currentValue: cleanText(profile.gpa, 40) || null,
    suggestedValue: formatExtractedGpa(extraction.extractedFields.gpa?.value),
    sourceSnippet: extraction.extractedFields.gpa?.sourceSnippet,
    confidence: extraction.extractedFields.gpa?.confidence,
  });

  addReviewItem(reviewItems, userPatch, questionnairePatch, {
    id: 'major',
    labelKey: 'profile.major',
    target: 'profile',
    currentValue: cleanText(profile.major, 160) || null,
    suggestedValue: cleanText(extraction.extractedFields.major?.value, 160),
    sourceSnippet: extraction.extractedFields.major?.sourceSnippet,
    confidence: extraction.extractedFields.major?.confidence,
  });

  addReviewItem(reviewItems, userPatch, questionnairePatch, {
    id: 'majorSignals',
    labelKey: 'profile.documentReaderFieldMajorSignals',
    target: 'questionnaire',
    currentValue: cleanText(questionnaire.majorSignals, 600) || null,
    suggestedValue: stringifyList(extraction.extractedFields.majorSignals?.value),
    sourceSnippet: extraction.extractedFields.majorSignals?.sourceSnippet,
    confidence: extraction.extractedFields.majorSignals?.confidence,
  });

  addReviewItem(reviewItems, userPatch, questionnairePatch, {
    id: 'completedCourses',
    labelKey: 'profile.documentReaderFieldCompletedCourses',
    target: 'questionnaire',
    currentValue: cleanText(questionnaire.completedCourses, 800) || null,
    suggestedValue: stringifyList(extraction.extractedFields.completedCourses?.value, '\n'),
    sourceSnippet: extraction.extractedFields.completedCourses?.sourceSnippet,
    confidence: extraction.extractedFields.completedCourses?.confidence,
  });

  addReviewItem(reviewItems, userPatch, questionnairePatch, {
    id: 'transferCredits',
    labelKey: 'profile.documentReaderFieldTransferCredits',
    target: 'questionnaire',
    currentValue: cleanText(questionnaire.transferCredits, 160) || null,
    suggestedValue: cleanText(extraction.extractedFields.transferCredits?.value, 160),
    sourceSnippet: extraction.extractedFields.transferCredits?.sourceSnippet,
    confidence: extraction.extractedFields.transferCredits?.confidence,
  });

  addReviewItem(reviewItems, userPatch, questionnairePatch, {
    id: 'resumeSkills',
    labelKey: 'questionnaire.resumeSkills',
    target: 'questionnaire',
    currentValue: cleanText(questionnaire.resumeSkills, 800) || null,
    suggestedValue: stringifyList(extraction.extractedFields.resumeSkills?.value),
    sourceSnippet: extraction.extractedFields.resumeSkills?.sourceSnippet,
    confidence: extraction.extractedFields.resumeSkills?.confidence,
  });

  return {
    documentType: input.documentType,
    fileName: input.fileName,
    items: reviewItems,
    userPatch,
    questionnairePatch,
    uncertainties: extraction.uncertainties,
    confidence: extraction.confidence,
  };
}

class DocumentReaderService {
  async extractDocumentReview(input: ExtractDocumentReviewInput): Promise<DocumentExtractionReview> {
    const fileName = cleanText(input.fileName, 180) || `${input.documentType}.pdf`;
    const mimeType = inferMimeType(fileName, input.mimeType);

    if (!isSupportedMimeType(mimeType)) {
      throw new Error('Document reading currently supports PDF, TXT, HTML, XML, PNG, JPG, and WEBP files.');
    }

    if ((input.size ?? 0) > MAX_INLINE_DOCUMENT_BYTES) {
      throw new Error('Document is too large to analyze inline. Please try a smaller PDF or image.');
    }

    const extraction = isStubMode()
      ? buildStubExtraction(input.documentType)
      : normalizeExtractionResult(
          input.documentType,
          await aiGatewayService.extractDocumentProfile({
            documentType: input.documentType,
            documentMeta: {
              fileName,
              mimeType,
              size: input.size ?? null,
            },
            currentProfile: input.currentProfile ?? {},
            questionnaire: input.questionnaireAnswers ?? {},
            fileBase64: await readFileAsBase64(input.fileUri),
            mimeType,
          }).then((response) => response.extraction)
        );

    return buildReview(
      {
        ...input,
        fileName,
      },
      extraction,
    );
  }
}

export const documentReaderService = new DocumentReaderService();
