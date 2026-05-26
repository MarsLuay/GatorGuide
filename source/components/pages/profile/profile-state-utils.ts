import { US_STATE_OPTIONS } from "@/services/app/questionnaire.enums";
import type { DocumentExtractionReview } from "@/services/documents/document-reader.service";

export type EditableProfileSnapshot = {
  name: string;
  state: string;
  major: string;
  gender: string;
  gpa: string;
  transcript: string;
  residencyType: string;
};

export const PROFILE_STATE_ABBREVIATIONS_BY_NAME: Record<string, string> = {
  Alabama: "AL",
  Alaska: "AK",
  Arizona: "AZ",
  Arkansas: "AR",
  California: "CA",
  Colorado: "CO",
  Connecticut: "CT",
  Delaware: "DE",
  Florida: "FL",
  Georgia: "GA",
  Hawaii: "HI",
  Idaho: "ID",
  Illinois: "IL",
  Indiana: "IN",
  Iowa: "IA",
  Kansas: "KS",
  Kentucky: "KY",
  Louisiana: "LA",
  Maine: "ME",
  Maryland: "MD",
  Massachusetts: "MA",
  Michigan: "MI",
  Minnesota: "MN",
  Mississippi: "MS",
  Missouri: "MO",
  Montana: "MT",
  Nebraska: "NE",
  Nevada: "NV",
  "New Hampshire": "NH",
  "New Jersey": "NJ",
  "New Mexico": "NM",
  "New York": "NY",
  "North Carolina": "NC",
  "North Dakota": "ND",
  Ohio: "OH",
  Oklahoma: "OK",
  Oregon: "OR",
  Pennsylvania: "PA",
  "Rhode Island": "RI",
  "South Carolina": "SC",
  "South Dakota": "SD",
  Tennessee: "TN",
  Texas: "TX",
  Utah: "UT",
  Vermont: "VT",
  Virginia: "VA",
  Washington: "WA",
  "West Virginia": "WV",
  Wisconsin: "WI",
  Wyoming: "WY",
  "District of Columbia": "DC",
};

const PROFILE_STATE_NAMES_BY_ABBREVIATION = new Map(
  Object.entries(PROFILE_STATE_ABBREVIATIONS_BY_NAME).map(([name, abbreviation]) => [
    abbreviation,
    name,
  ])
);

export function normalizeProfileStateSearchValue(value: string | undefined | null) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveProfileStateName(value: string | undefined | null) {
  const trimmedValue = String(value ?? "").trim();
  if (!trimmedValue) return null;

  const abbreviationMatch = PROFILE_STATE_NAMES_BY_ABBREVIATION.get(trimmedValue.toUpperCase());
  if (abbreviationMatch) {
    return abbreviationMatch;
  }

  const normalizedValue = normalizeProfileStateSearchValue(trimmedValue);
  return (
    US_STATE_OPTIONS.find(
      (stateName) => normalizeProfileStateSearchValue(stateName) === normalizedValue
    ) ?? null
  );
}

export function formatProfileStateDisplayValue(value: string | undefined | null) {
  const resolvedStateName = resolveProfileStateName(value);
  if (resolvedStateName) {
    return resolvedStateName;
  }

  const trimmedValue = String(value ?? "").trim();
  if (!trimmedValue) return "";

  return trimmedValue
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

export function looksLikeEncodedFileName(value: string | undefined | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return true;
  if (raw.startsWith("data:") || raw.startsWith("blob:")) return true;
  if (raw.includes("base64,")) return true;
  return /^[A-Za-z0-9+/=]{120,}$/.test(raw.replace(/\s+/g, ""));
}

export function getReadableDocumentFileName({
  name,
  url,
  fallbackName,
}: {
  name?: string | null;
  url?: string | null;
  fallbackName: string;
}) {
  const rawName = String(name ?? "").trim();
  if (rawName && rawName.length <= 180 && !looksLikeEncodedFileName(rawName)) {
    return rawName;
  }

  const rawUrl = String(url ?? "").trim();
  if (!rawUrl) return "";
  if (rawUrl.startsWith("data:") || rawUrl.startsWith("blob:")) {
    return fallbackName;
  }

  const withoutQuery = rawUrl.split(/[?#]/)[0] ?? "";
  const lastSegment = withoutQuery.split("/").pop() ?? "";
  try {
    const decoded = decodeURIComponent(lastSegment).trim();
    if (decoded && decoded.length <= 180 && !looksLikeEncodedFileName(decoded)) {
      return decoded;
    }
  } catch {
    const trimmed = lastSegment.trim();
    if (trimmed && trimmed.length <= 180 && !looksLikeEncodedFileName(trimmed)) {
      return trimmed;
    }
  }

  return fallbackName;
}

export function hasProfileGpaValue(value: string | undefined | null) {
  return String(value ?? "").trim().length > 0;
}

export function formatProfileGpaDisplay(value: string | undefined | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const match = raw.match(/-?\d+(?:\.\d+)?/);
  if (!match) return raw;
  const num = Number.parseFloat(match[0]);
  if (!Number.isFinite(num)) return raw;
  const clamped = Math.max(0, Math.min(num, 4.0));
  const truncated = Math.floor(clamped * 100) / 100;
  return truncated.toFixed(2).replace(/\.0+$|0+$/g, "");
}

export function getProfileGpaInputState(value: string) {
  if (value !== "" && !/^\d*\.?\d*$/.test(value)) {
    return { accepted: false, numericValue: null };
  }

  const parts = value.split(".");
  const intPart = parts[0] ?? "";
  const fracPart = parts[1] ?? "";

  if (fracPart.length > 2) {
    return { accepted: false, numericValue: null };
  }

  if (intPart === "4" && value.includes(".")) {
    return { accepted: false, numericValue: null };
  }

  const numericValue = Number(value);
  const isEmptyOrZeroish = value === "" || value === "0" || value === "0.";
  if (
    isEmptyOrZeroish ||
    (Number.isFinite(numericValue) && (value.includes(".") ? numericValue <= 3.99 : numericValue <= 4.0))
  ) {
    return { accepted: true, numericValue };
  }

  return { accepted: false, numericValue: null };
}

export function omitProfileReviewField(
  review: DocumentExtractionReview,
  fieldId: string
): DocumentExtractionReview {
  const userPatch = { ...review.userPatch };
  delete userPatch[fieldId];

  return {
    ...review,
    userPatch,
    items: review.items.filter(
      (item) => !(item.target === "profile" && item.id === fieldId)
    ),
  };
}

export function omitQuestionnaireReviewField(
  review: DocumentExtractionReview,
  fieldId: string
): DocumentExtractionReview {
  const questionnairePatch = { ...review.questionnairePatch };
  delete questionnairePatch[fieldId];

  return {
    ...review,
    questionnairePatch,
    items: review.items.filter(
      (item) => !(item.target === "questionnaire" && item.id === fieldId)
    ),
  };
}

type ProfileMajorLookup = {
  get: (key: string) => string | undefined;
};

function resolveProfileMajor(value: string | undefined | null, majorLookup: ProfileMajorLookup) {
  const trimmedValue = String(value ?? "").trim();
  return trimmedValue ? majorLookup.get(trimmedValue.toLowerCase()) ?? trimmedValue : "";
}

export function normalizeEditableProfileSnapshot(
  draft: EditableProfileSnapshot,
  majorLookup: ProfileMajorLookup
): EditableProfileSnapshot {
  return {
    name: draft.name,
    state: resolveProfileStateName(draft.state) ?? String(draft.state ?? "").trim(),
    major: resolveProfileMajor(draft.major, majorLookup),
    gender: draft.gender,
    gpa: formatProfileGpaDisplay(draft.gpa),
    transcript: draft.transcript,
    residencyType: draft.residencyType,
  };
}

export function buildProfileDraftPatch(
  normalizedProfileDraft: EditableProfileSnapshot,
  persistedProfileDraft: EditableProfileSnapshot
) {
  const patch: Partial<EditableProfileSnapshot> = {};

  (Object.keys(normalizedProfileDraft) as (keyof EditableProfileSnapshot)[]).forEach((key) => {
    if (normalizedProfileDraft[key] !== persistedProfileDraft[key]) {
      patch[key] = normalizedProfileDraft[key];
    }
  });

  return patch;
}
