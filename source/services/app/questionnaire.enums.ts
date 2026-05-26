import { QUESTIONNAIRE_FIELD_IDS, type QuestionnaireFieldId } from '@/constants/schema';
import type { Language } from './translations';
import { translations } from './translations';

export const QUESTIONNAIRE_RADIO_OPTIONS = {
  costOfAttendance: [
    { key: 'under_20k', labelKey: 'questionnaire.under20k' },
    { key: '20k_to_40k', labelKey: 'questionnaire.20to40k' },
    { key: '40k_to_60k', labelKey: 'questionnaire.40to60k' },
    { key: 'over_60k', labelKey: 'questionnaire.over60k' },
    { key: 'no_preference', labelKey: 'questionnaire.noPreference' },
  ],
  classSize: [
    { key: 'small', labelKey: 'questionnaire.small' },
    { key: 'large', labelKey: 'questionnaire.large' },
    { key: 'no_preference', labelKey: 'questionnaire.noPreference' },
  ],
  transportation: [
    { key: 'car', labelKey: 'questionnaire.transportCar' },
    { key: 'transit', labelKey: 'questionnaire.transportTransit' },
    { key: 'bike', labelKey: 'questionnaire.transportBike' },
    { key: 'walk', labelKey: 'questionnaire.transportWalk' },
    { key: 'no_preference', labelKey: 'questionnaire.noPreference' },
  ],
  inStateOutOfState: [
    { key: 'in_state', labelKey: 'questionnaire.inState' },
    { key: 'out_of_state', labelKey: 'questionnaire.outOfState' },
    { key: 'no_preference', labelKey: 'questionnaire.noPreference' },
  ],
  housing: [
    { key: 'on_campus', labelKey: 'questionnaire.onCampus' },
    { key: 'off_campus', labelKey: 'questionnaire.offCampus' },
    { key: 'commute', labelKey: 'questionnaire.commute' },
    { key: 'no_preference', labelKey: 'questionnaire.noPreference' },
  ],
  ranking: [
    { key: 'very_important', labelKey: 'questionnaire.veryImportant' },
    { key: 'somewhat_important', labelKey: 'questionnaire.somewhatImportant' },
    { key: 'not_important', labelKey: 'questionnaire.notImportant' },
  ],
  continueEducation: [
    { key: 'yes', labelKey: 'questionnaire.yes' },
    { key: 'no', labelKey: 'questionnaire.no' },
    { key: 'maybe', labelKey: 'questionnaire.maybe' },
  ],
  lgbtqCommunity: [
    { key: 'yes', labelKey: 'questionnaire.yes' },
    { key: 'no', labelKey: 'questionnaire.no' },
    { key: 'prefer_not_to_say', labelKey: 'questionnaire.preferNotToSay' },
  ],
} as const;

type RadioField = keyof typeof QUESTIONNAIRE_RADIO_OPTIONS;

export type QuestionnaireAnswerValue =
  | string
  | number
  | boolean
  | null
  | QuestionnaireAnswerValue[]
  | { [key: string]: QuestionnaireAnswerValue };

export type QuestionnaireAnswers = Record<string, QuestionnaireAnswerValue>;

type QuestionnaireRecordInput = Record<string, unknown>;

const STATE_ABBR_TO_NAME: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia',
};

export const US_STATE_OPTIONS = Object.freeze(Object.values(STATE_ABBR_TO_NAME));

export const LOCATION_PRIMARY_OPTIONS = [
  { key: 'washington_only', labelKey: 'questionnaire.locationWashingtonOnly' },
  { key: 'near_current_location', labelKey: 'questionnaire.locationNearCurrent' },
  { key: 'specific_state', labelKey: 'questionnaire.locationStateOption' },
  { key: 'specific_region', labelKey: 'questionnaire.locationRegionOption' },
  { key: 'no_preference', labelKey: 'questionnaire.noPreference' },
  { key: 'other', labelKey: 'questionnaire.locationOther' },
] as const;

export const LOCATION_REGION_OPTIONS = [
  { key: 'pacific_northwest', labelKey: 'questionnaire.regionPacificNorthwest', states: ['Washington', 'Oregon', 'Idaho'] },
  { key: 'west_coast', labelKey: 'questionnaire.regionWestCoast', states: ['Washington', 'Oregon', 'California'] },
  { key: 'southwest', labelKey: 'questionnaire.regionSouthwest', states: ['Arizona', 'New Mexico', 'Texas', 'Oklahoma', 'Nevada'] },
  { key: 'midwest', labelKey: 'questionnaire.regionMidwest', states: ['North Dakota', 'South Dakota', 'Nebraska', 'Kansas', 'Minnesota', 'Iowa', 'Missouri', 'Wisconsin', 'Illinois', 'Indiana', 'Michigan', 'Ohio'] },
  { key: 'south', labelKey: 'questionnaire.regionSouth', states: ['Delaware', 'Maryland', 'District of Columbia', 'Virginia', 'West Virginia', 'North Carolina', 'South Carolina', 'Georgia', 'Florida', 'Kentucky', 'Tennessee', 'Mississippi', 'Alabama', 'Oklahoma', 'Texas', 'Arkansas', 'Louisiana'] },
  { key: 'northeast', labelKey: 'questionnaire.regionNortheast', states: ['Maine', 'New Hampshire', 'Vermont', 'Massachusetts', 'Rhode Island', 'Connecticut', 'New York', 'New Jersey', 'Pennsylvania'] },
] as const;

export type LocationPrimaryOptionKey = typeof LOCATION_PRIMARY_OPTIONS[number]['key'];
export type LocationRegionKey = typeof LOCATION_REGION_OPTIONS[number]['key'];

export type ParsedLocationPreference =
  | { kind: 'washington_only' | 'near_current_location' | 'no_preference'; raw: string }
  | { kind: 'state'; raw: string; state: string }
  | { kind: 'region'; raw: string; regionKey: LocationRegionKey }
  | { kind: 'other'; raw: string; otherText: string }
  | { kind: 'unknown'; raw: string };

const norm = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ')
    .replace(/[^\p{L}\p{N} ]/gu, '');

const allLanguageBundles = Object.values(translations) as Record<string, string>[];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export function isQuestionnaireAnswerValue(value: unknown): value is QuestionnaireAnswerValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isQuestionnaireAnswerValue);
  if (!isRecord(value)) return false;
  return Object.values(value).every(isQuestionnaireAnswerValue);
}

function coerceQuestionnaireAnswers(answers: QuestionnaireRecordInput | null | undefined): QuestionnaireAnswers {
  if (!isRecord(answers)) return {};

  const normalized: QuestionnaireAnswers = {};
  for (const [key, value] of Object.entries(answers)) {
    if (isQuestionnaireAnswerValue(value)) {
      normalized[key] = value;
    }
  }
  return normalized;
}

export function getQuestionnaireAnswerText(
  answers: QuestionnaireRecordInput | null | undefined,
  fieldId: string
) {
  const value = answers?.[fieldId];
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

const normalizeStateName = (value: unknown): string | null => {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  if (raw.length === 2) {
    const resolved = STATE_ABBR_TO_NAME[raw.toUpperCase()];
    return resolved ?? null;
  }

  const normalized = norm(raw);
  const found = Object.values(STATE_ABBR_TO_NAME).find((state) => norm(state) === normalized);
  return found ?? null;
};

const normalizeRegionKey = (value: unknown, activeLanguage?: Language): LocationRegionKey | null => {
  const normalized = norm(value);
  if (!normalized) return null;

  const direct = LOCATION_REGION_OPTIONS.find((option) => norm(option.key) === normalized);
  if (direct) return direct.key;

  const languagesToCheck: Record<string, string>[] = [];
  if (activeLanguage && translations[activeLanguage]) languagesToCheck.push(translations[activeLanguage]);
  languagesToCheck.push(...allLanguageBundles);

  for (const bundle of languagesToCheck) {
    for (const option of LOCATION_REGION_OPTIONS) {
      const translated = bundle[option.labelKey];
      if (translated && norm(translated) === normalized) return option.key;
    }
  }

  return null;
};

export function buildStateLocationPreference(state: string) {
  const normalizedState = normalizeStateName(state);
  return normalizedState ? `state:${normalizedState}` : '';
}

export function buildRegionLocationPreference(regionKey: string) {
  const normalizedRegion = normalizeRegionKey(regionKey);
  return normalizedRegion ? `region:${normalizedRegion}` : '';
}

export function buildOtherLocationPreference(text: string) {
  const trimmed = String(text ?? '').trim();
  return trimmed ? `other:${trimmed}` : '';
}

export function getLocationRegionStates(regionKey: string): string[] {
  const states = LOCATION_REGION_OPTIONS.find((option) => option.key === regionKey)?.states;
  return states ? [...states] : [];
}

export function parseLocationPreference(value: unknown, activeLanguage?: Language): ParsedLocationPreference {
  const raw = String(value ?? '').trim();
  if (!raw) return { kind: 'unknown', raw: '' };

  const normalized = norm(raw);
  if (normalized === 'washington only' || normalized === 'washington_only') {
    return { kind: 'washington_only', raw };
  }
  if (
    normalized === 'near current location' ||
    normalized === 'near_current_location' ||
    normalized === 'nearby current location'
  ) {
    return { kind: 'near_current_location', raw };
  }
  if (normalized === 'no preference' || normalized === 'no_preference') {
    return { kind: 'no_preference', raw };
  }

  if (raw.startsWith('state:')) {
    const state = normalizeStateName(raw.slice('state:'.length));
    return state ? { kind: 'state', raw, state } : { kind: 'unknown', raw };
  }

  if (raw.startsWith('region:')) {
    const regionKey = normalizeRegionKey(raw.slice('region:'.length), activeLanguage);
    return regionKey ? { kind: 'region', raw, regionKey } : { kind: 'unknown', raw };
  }

  if (raw.startsWith('other:')) {
    const otherText = raw.slice('other:'.length).trim();
    return otherText ? { kind: 'other', raw, otherText } : { kind: 'unknown', raw };
  }

  const state = normalizeStateName(raw);
  if (state) {
    if (state === 'Washington') return { kind: 'washington_only', raw };
    return { kind: 'state', raw, state };
  }

  const regionKey = normalizeRegionKey(raw, activeLanguage);
  if (regionKey) return { kind: 'region', raw, regionKey };

  const languagesToCheck: Record<string, string>[] = [];
  if (activeLanguage && translations[activeLanguage]) languagesToCheck.push(translations[activeLanguage]);
  languagesToCheck.push(...allLanguageBundles);

  for (const bundle of languagesToCheck) {
    const washingtonOnly = bundle['questionnaire.locationWashingtonOnly'];
    if (washingtonOnly && norm(washingtonOnly) === normalized) {
      return { kind: 'washington_only', raw };
    }

    const nearCurrent = bundle['questionnaire.locationNearCurrent'];
    if (nearCurrent && norm(nearCurrent) === normalized) {
      return { kind: 'near_current_location', raw };
    }

    const noPreference = bundle['questionnaire.noPreference'];
    if (noPreference && norm(noPreference) === normalized) {
      return { kind: 'no_preference', raw };
    }
  }

  return { kind: 'other', raw, otherText: raw };
}

export function normalizeLocationPreference(value: unknown, activeLanguage?: Language): string {
  const parsed = parseLocationPreference(value, activeLanguage);

  switch (parsed.kind) {
    case 'washington_only':
    case 'near_current_location':
    case 'no_preference':
      return parsed.kind;
    case 'state':
      return buildStateLocationPreference(parsed.state);
    case 'region':
      return buildRegionLocationPreference(parsed.regionKey);
    case 'other':
      return buildOtherLocationPreference(parsed.otherText);
    default:
      return '';
  }
}

const mapLegacyValue = (field: RadioField, rawValue: unknown, activeLanguage?: Language) => {
  const v = norm(rawValue);
  if (!v) return null;

  const options = QUESTIONNAIRE_RADIO_OPTIONS[field];
  const direct = options.find((opt) => norm(opt.key) === v || norm(opt.key).replace(/ /g, '') === v.replace(/ /g, ''));
  if (direct) return direct.key;

  const languagesToCheck: Record<string, string>[] = [];
  if (activeLanguage && translations[activeLanguage]) languagesToCheck.push(translations[activeLanguage]);
  languagesToCheck.push(...allLanguageBundles);

  for (const bundle of languagesToCheck) {
    for (const option of options) {
      const translated = bundle[option.labelKey];
      if (translated && norm(translated) === v) return option.key;
    }
  }

  return null;
};

export function normalizeQuestionnaireAnswers(
  answers: QuestionnaireRecordInput | null | undefined,
  activeLanguage?: Language
): QuestionnaireAnswers {
  const normalized = coerceQuestionnaireAnswers(answers);

  (Object.keys(QUESTIONNAIRE_RADIO_OPTIONS) as RadioField[]).forEach((field) => {
    if (!(field in normalized)) return;
    const mapped = mapLegacyValue(field, normalized[field], activeLanguage);
    if (mapped) normalized[field] = mapped;
    else normalized[field] = 'no_preference';
  });

  if (QUESTIONNAIRE_FIELD_IDS.location in normalized) {
    normalized[QUESTIONNAIRE_FIELD_IDS.location] = normalizeLocationPreference(
      normalized[QUESTIONNAIRE_FIELD_IDS.location],
      activeLanguage
    );
  }

  if (typeof normalized[QUESTIONNAIRE_FIELD_IDS.useWeightedSearch] !== 'boolean') {
    if (
      String(normalized[QUESTIONNAIRE_FIELD_IDS.useWeightedSearch]).toLowerCase() === 'false'
    ) {
      normalized[QUESTIONNAIRE_FIELD_IDS.useWeightedSearch] = false;
    } else {
      normalized[QUESTIONNAIRE_FIELD_IDS.useWeightedSearch] = true;
    }
  }

  return normalized;
}
