import type { ParsedTranscriptCourse } from "@/services/documents/transcript-pdf.service";
import type { UploadedFile } from "@/services/storage/storage.service";
import {
  TRANSFER_PLANNER_LEGACY_COMPLETED_COURSES_FIELD,
  TRANSFER_PLANNER_TRANSCRIPT_CACHE_FIELDS,
  TRANSFER_PLANNER_TRANSCRIPT_COURSES_FIELD,
  TRANSFER_PLANNER_TRANSCRIPT_EARNED_CREDITS_FIELD,
  TRANSFER_PLANNER_TRANSCRIPT_PARSER_VERSION_FIELD,
  TRANSFER_PLANNER_TRANSCRIPT_SOURCE_FIELD,
  TRANSFER_PLANNER_TRANSCRIPT_UPLOADED_AT_FIELD,
} from "@/constants/planner-storage";

export const TRANSCRIPT_COURSES_FIELD = TRANSFER_PLANNER_TRANSCRIPT_COURSES_FIELD;
export const TRANSCRIPT_SOURCE_FIELD = TRANSFER_PLANNER_TRANSCRIPT_SOURCE_FIELD;
export const TRANSCRIPT_UPLOADED_AT_FIELD =
  TRANSFER_PLANNER_TRANSCRIPT_UPLOADED_AT_FIELD;
export const TRANSCRIPT_PARSER_VERSION_FIELD =
  TRANSFER_PLANNER_TRANSCRIPT_PARSER_VERSION_FIELD;
export const TRANSCRIPT_EARNED_CREDITS_FIELD =
  TRANSFER_PLANNER_TRANSCRIPT_EARNED_CREDITS_FIELD;
export const TRANSCRIPT_PARSER_VERSION = 2;
export const TRANSCRIPT_ESTIMATED_CREDITS_PER_TERM = 15;

type TranscriptTermName = "winter" | "spring" | "summer" | "fall";

type TranscriptTermDescriptor = {
  name: TranscriptTermName;
  year: number;
  label: string;
  sequenceIndex: number;
  estimatedEndDateKey: number;
};

export type TransferPlannerTranscriptCreditEstimate = {
  earnedCreditsTotal: number;
  estimatedCurrentCreditsTotal: number;
  estimatedAdditionalCredits: number;
  assumedCreditsPerTerm: number;
  estimatedTerms: string[];
  latestTranscriptTermLabel: string | null;
  latestTranscriptTermEndDate: string | null;
  asOf: string;
  usedProjection: boolean;
};

const TRANSCRIPT_TERM_SEQUENCE: TranscriptTermName[] = [
  "winter",
  "spring",
  "summer",
  "fall",
];

const TRANSCRIPT_CREDIT_PROJECTION_TERMS = new Set<TranscriptTermName>([
  "winter",
  "spring",
  "fall",
]);

const TRANSCRIPT_TERM_LABELS: Record<TranscriptTermName, string> = {
  winter: "Winter",
  spring: "Spring",
  summer: "Summer",
  fall: "Fall",
};

function parsePositiveCreditValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseIsoDateKey(value: unknown) {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.getUTCFullYear() * 10000 + (parsed.getUTCMonth() + 1) * 100 + parsed.getUTCDate();
  }

  const year = Number.parseInt(match[1] ?? "", 10);
  const month = Number.parseInt(match[2] ?? "", 10);
  const day = Number.parseInt(match[3] ?? "", 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  return year * 10000 + month * 100 + day;
}

function parseReferenceDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  const parsed = new Date(String(value ?? ""));
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function dateKeyToIsoDate(value: number | null) {
  if (value == null) return null;
  const raw = String(value).padStart(8, "0");
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

function getTermNameFromDateKey(dateKey: number | null): TranscriptTermName | null {
  if (dateKey == null) return null;
  const month = Math.floor((dateKey % 10000) / 100);
  if (month >= 1 && month <= 3) return "winter";
  if (month >= 4 && month <= 6) return "spring";
  if (month >= 7 && month <= 8) return "summer";
  if (month >= 9 && month <= 12) return "fall";
  return null;
}

function normalizeTranscriptTermName(value: unknown): TranscriptTermName | null {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return null;
  if (raw === "autumn" || raw === "fall") return "fall";
  if (raw === "winter") return "winter";
  if (raw === "spring") return "spring";
  if (raw === "summer") return "summer";
  return null;
}

function formatTranscriptTermLabel(termName: TranscriptTermName, year: number) {
  return `${TRANSCRIPT_TERM_LABELS[termName]} ${year}`;
}

function getEstimatedTermEndDateKey(termName: TranscriptTermName, year: number) {
  switch (termName) {
    case "winter":
      return year * 10000 + 331;
    case "spring":
      return year * 10000 + 630;
    case "summer":
      return year * 10000 + 831;
    case "fall":
      return year * 10000 + 1231;
  }
}

function buildTermDescriptor(termName: TranscriptTermName, year: number): TranscriptTermDescriptor | null {
  if (!Number.isFinite(year) || year < 1900 || year > 2200) return null;
  const termIndex = TRANSCRIPT_TERM_SEQUENCE.indexOf(termName);
  if (termIndex < 0) return null;

  return {
    name: termName,
    year,
    label: formatTranscriptTermLabel(termName, year),
    sequenceIndex: year * TRANSCRIPT_TERM_SEQUENCE.length + termIndex,
    estimatedEndDateKey: getEstimatedTermEndDateKey(termName, year),
  };
}

function getTermDescriptorFromSequenceIndex(sequenceIndex: number) {
  const termCount = TRANSCRIPT_TERM_SEQUENCE.length;
  const year = Math.floor(sequenceIndex / termCount);
  const termName = TRANSCRIPT_TERM_SEQUENCE[sequenceIndex % termCount];
  return termName ? buildTermDescriptor(termName, year) : null;
}

function inferTranscriptTermDescriptorFromRecord(record: Record<string, unknown>) {
  const termMatch = String(record.termLabel ?? "").match(
    /\b(Fall|Autumn|Winter|Spring|Summer)\s+(\d{4})\b/i
  );
  if (termMatch) {
    const termName = normalizeTranscriptTermName(termMatch[1]);
    const year = Number.parseInt(termMatch[2] ?? "", 10);
    if (termName) return buildTermDescriptor(termName, year);
  }

  const termDateKey =
    parseIsoDateKey(record.termEndDate) ?? parseIsoDateKey(record.termStartDate);
  const termName = getTermNameFromDateKey(termDateKey);
  if (!termName || termDateKey == null) return null;
  return buildTermDescriptor(termName, Math.floor(termDateKey / 10000));
}

function getStoredTranscriptCourses(questionnaireAnswers: Record<string, unknown> | null | undefined) {
  const storedCourses = questionnaireAnswers?.[TRANSCRIPT_COURSES_FIELD];
  return Array.isArray(storedCourses) ? storedCourses : [];
}

export function getTransferPlannerTranscriptEarnedCreditsTotal(
  questionnaireAnswers: Record<string, unknown> | null | undefined
) {
  const storedTotal = parsePositiveCreditValue(
    questionnaireAnswers?.[TRANSCRIPT_EARNED_CREDITS_FIELD]
  );
  if (storedTotal != null) return storedTotal;

  let total = 0;
  let hasCreditValues = false;

  for (const rawCourse of getStoredTranscriptCourses(questionnaireAnswers)) {
    if (!rawCourse || typeof rawCourse !== "object" || Array.isArray(rawCourse)) {
      continue;
    }

    const record = rawCourse as Record<string, unknown>;
    const credits = parsePositiveCreditValue(
      record.credits ?? record.earnedCredits ?? record.credit
    );
    if (credits == null) continue;

    total += credits;
    hasCreditValues = true;
  }

  return hasCreditValues ? Math.round(total * 1000) / 1000 : null;
}

function getLatestTranscriptTerm(
  questionnaireAnswers: Record<string, unknown> | null | undefined
) {
  let latest: {
    descriptor: TranscriptTermDescriptor;
    exactEndDateKey: number | null;
  } | null = null;

  for (const rawCourse of getStoredTranscriptCourses(questionnaireAnswers)) {
    if (!rawCourse || typeof rawCourse !== "object" || Array.isArray(rawCourse)) {
      continue;
    }

    const record = rawCourse as Record<string, unknown>;
    const descriptor = inferTranscriptTermDescriptorFromRecord(record);
    if (!descriptor) continue;

    const exactEndDateKey = parseIsoDateKey(record.termEndDate);
    if (!latest || descriptor.sequenceIndex > latest.descriptor.sequenceIndex) {
      latest = { descriptor, exactEndDateKey };
    }
  }

  return latest;
}

function getEstimatedTranscriptTermsAfter(
  latestTerm: TranscriptTermDescriptor,
  referenceDateKey: number
) {
  const estimatedTerms: TranscriptTermDescriptor[] = [];
  const referenceYear = Math.floor(referenceDateKey / 10000);
  const lastPossibleSequenceIndex =
    referenceYear * TRANSCRIPT_TERM_SEQUENCE.length + TRANSCRIPT_TERM_SEQUENCE.length - 1;

  for (
    let sequenceIndex = latestTerm.sequenceIndex + 1;
    sequenceIndex <= lastPossibleSequenceIndex;
    sequenceIndex += 1
  ) {
    const descriptor = getTermDescriptorFromSequenceIndex(sequenceIndex);
    if (!descriptor) continue;
    if (!TRANSCRIPT_CREDIT_PROJECTION_TERMS.has(descriptor.name)) continue;
    if (descriptor.estimatedEndDateKey > referenceDateKey) continue;
    estimatedTerms.push(descriptor);
  }

  return estimatedTerms;
}

export function estimateTransferPlannerTranscriptCurrentCredits(
  questionnaireAnswers: Record<string, unknown> | null | undefined,
  options: {
    asOf?: Date | string | null;
    assumedCreditsPerTerm?: number;
  } = {}
): TransferPlannerTranscriptCreditEstimate | null {
  const earnedCreditsTotal = getTransferPlannerTranscriptEarnedCreditsTotal(
    questionnaireAnswers
  );
  if (earnedCreditsTotal == null) return null;

  const referenceDate = parseReferenceDate(options.asOf ?? new Date());
  const referenceDateKey = parseIsoDateKey(referenceDate.toISOString());
  const assumedCreditsPerTerm = parsePositiveCreditValue(options.assumedCreditsPerTerm) ??
    TRANSCRIPT_ESTIMATED_CREDITS_PER_TERM;
  const latestTerm = getLatestTranscriptTerm(questionnaireAnswers);

  if (!latestTerm || referenceDateKey == null) {
    return {
      earnedCreditsTotal,
      estimatedCurrentCreditsTotal: earnedCreditsTotal,
      estimatedAdditionalCredits: 0,
      assumedCreditsPerTerm,
      estimatedTerms: [],
      latestTranscriptTermLabel: latestTerm?.descriptor.label ?? null,
      latestTranscriptTermEndDate: dateKeyToIsoDate(
        latestTerm?.exactEndDateKey ?? latestTerm?.descriptor.estimatedEndDateKey ?? null
      ),
      asOf: referenceDate.toISOString(),
      usedProjection: false,
    };
  }

  const estimatedTerms = getEstimatedTranscriptTermsAfter(
    latestTerm.descriptor,
    referenceDateKey
  );
  const estimatedAdditionalCredits = estimatedTerms.length * assumedCreditsPerTerm;
  const estimatedCurrentCreditsTotal =
    Math.round((earnedCreditsTotal + estimatedAdditionalCredits) * 1000) / 1000;

  return {
    earnedCreditsTotal,
    estimatedCurrentCreditsTotal,
    estimatedAdditionalCredits,
    assumedCreditsPerTerm,
    estimatedTerms: estimatedTerms.map((term) => term.label),
    latestTranscriptTermLabel: latestTerm.descriptor.label,
    latestTranscriptTermEndDate: dateKeyToIsoDate(
      latestTerm.exactEndDateKey ?? latestTerm.descriptor.estimatedEndDateKey
    ),
    asOf: referenceDate.toISOString(),
    usedProjection: estimatedAdditionalCredits > 0,
  };
}

export function clearTransferPlannerTranscriptCache(
  questionnaireAnswers: Record<string, unknown> | null | undefined
) {
  const nextQuestionnaireAnswers: Record<string, unknown> = {
    ...(questionnaireAnswers ?? {}),
  };

  delete nextQuestionnaireAnswers[TRANSFER_PLANNER_LEGACY_COMPLETED_COURSES_FIELD];

  for (const field of TRANSFER_PLANNER_TRANSCRIPT_CACHE_FIELDS) {
    delete nextQuestionnaireAnswers[field];
  }

  return nextQuestionnaireAnswers;
}

export function buildTransferPlannerTranscriptCachePatch(
  document: Pick<UploadedFile, "url" | "uploadedAt">,
  completedCourses: ParsedTranscriptCourse[],
  earnedCreditsTotal?: number | null
) {
  const resolvedEarnedCreditsTotal =
    typeof earnedCreditsTotal === "number" && Number.isFinite(earnedCreditsTotal)
      ? earnedCreditsTotal
      : completedCourses.reduce((total, course) => {
          const credits = Number(course.credits);
          return Number.isFinite(credits) && credits > 0 ? total + credits : total;
        }, 0);

  return {
    [TRANSCRIPT_COURSES_FIELD]: completedCourses,
    [TRANSFER_PLANNER_LEGACY_COMPLETED_COURSES_FIELD]: completedCourses.map(
      (course) => course.label
    ),
    [TRANSCRIPT_SOURCE_FIELD]: document.url,
    [TRANSCRIPT_PARSER_VERSION_FIELD]: TRANSCRIPT_PARSER_VERSION,
    [TRANSCRIPT_UPLOADED_AT_FIELD]: document.uploadedAt || new Date().toISOString(),
    [TRANSCRIPT_EARNED_CREDITS_FIELD]:
      resolvedEarnedCreditsTotal > 0
        ? Math.round(resolvedEarnedCreditsTotal * 1000) / 1000
        : null,
  };
}
