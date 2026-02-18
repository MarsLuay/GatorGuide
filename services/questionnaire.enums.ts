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
} as const;

type RadioField = keyof typeof QUESTIONNAIRE_RADIO_OPTIONS;

type QuestionnaireRecord = Record<string, any>;

const norm = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ')
    .replace(/[^\p{L}\p{N} ]/gu, '');

const allLanguageBundles = Object.values(translations) as Array<Record<string, string>>;

const mapLegacyValue = (field: RadioField, rawValue: unknown, activeLanguage?: Language) => {
  const v = norm(rawValue);
  if (!v) return null;

  const options = QUESTIONNAIRE_RADIO_OPTIONS[field];
  const direct = options.find((opt) => norm(opt.key) === v || norm(opt.key).replace(/ /g, '') === v.replace(/ /g, ''));
  if (direct) return direct.key;

  const languagesToCheck: Array<Record<string, string>> = [];
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

export function normalizeQuestionnaireAnswers(answers: QuestionnaireRecord | null | undefined, activeLanguage?: Language) {
  const normalized: QuestionnaireRecord = { ...(answers ?? {}) };

  (Object.keys(QUESTIONNAIRE_RADIO_OPTIONS) as RadioField[]).forEach((field) => {
    if (!(field in normalized)) return;
    const mapped = mapLegacyValue(field, normalized[field], activeLanguage);
    if (mapped) normalized[field] = mapped;
    else normalized[field] = 'no_preference';
  });

  if (typeof normalized.useWeightedSearch !== 'boolean') {
    if (String(normalized.useWeightedSearch).toLowerCase() === 'false') normalized.useWeightedSearch = false;
    else normalized.useWeightedSearch = true;
  }

  return normalized;
}
