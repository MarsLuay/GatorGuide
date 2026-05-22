import { DEFAULT_USER_STATE } from "@/constants/profile-defaults";
import {
  FIRESTORE_SYNCABLE_PROFILE_FIELD_KEYS,
  STORAGE_KEYS,
  type FirestoreSyncableProfileFieldKey,
} from "@/constants/schema";
import { normalizeQuestionnaireAnswers } from "@/services/app/questionnaire.enums";
import type { College } from "@/services/colleges/college.service";
import { savedCollegesService } from "@/services/colleges/saved-colleges.service";

export type User = {
  uid: string;
  name: string;
  email: string;
  isGuest?: boolean; // true if user is logged in as guest
  avatar?: string; // URI to profile avatar image
  state?: string;
  major?: string;
  gender?: string;
  /** American in-state | American out-of-state | International */
  residencyType?: string;
  gpa?: string;
  resume?: string;
  transcript?: string;
  isProfileComplete?: boolean;
  /** Whether the user has seen the onboarding/tutorial */
  hasSeenOnboarding?: boolean;
};

export type QuestionnaireAnswers = Record<string, any>;

export type NotificationPreferences = {
  transferDeadlines: boolean;
  collegeDeadlines: boolean;
  scholarships: boolean;
  internships: boolean;
  generalDeadlines: boolean;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  transferDeadlines: true,
  collegeDeadlines: true,
  scholarships: true,
  internships: true,
  generalDeadlines: true,
};

export type AppDataState = {
  user: User | null;
  questionnaireAnswers: QuestionnaireAnswers;
  notificationsEnabled: boolean;
  notificationPreferences: NotificationPreferences;
  savedColleges: College[];
};

export const STORAGE_KEY = STORAGE_KEYS.appData;

export const initialState: AppDataState = {
  user: null,
  questionnaireAnswers: {},
  notificationsEnabled: false,
  notificationPreferences: { ...DEFAULT_NOTIFICATION_PREFERENCES },
  savedColleges: [],
};

export function withDefaultUserState<T extends Partial<User> | null | undefined>(user: T): T {
  if (!user) return user;
  if (String(user.state ?? "").trim()) return user;
  return { ...user, state: DEFAULT_USER_STATE };
}

export function resolveUserState(value: unknown) {
  return String(value ?? "").trim() || DEFAULT_USER_STATE;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function normalizeNotificationPreferences(value: unknown): NotificationPreferences {
  if (!isRecord(value)) {
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }

  return {
    transferDeadlines:
      typeof value.transferDeadlines === "boolean"
        ? value.transferDeadlines
        : DEFAULT_NOTIFICATION_PREFERENCES.transferDeadlines,
    collegeDeadlines:
      typeof value.collegeDeadlines === "boolean"
        ? value.collegeDeadlines
        : DEFAULT_NOTIFICATION_PREFERENCES.collegeDeadlines,
    scholarships:
      typeof value.scholarships === "boolean"
        ? value.scholarships
        : DEFAULT_NOTIFICATION_PREFERENCES.scholarships,
    internships:
      typeof value.internships === "boolean"
        ? value.internships
        : DEFAULT_NOTIFICATION_PREFERENCES.internships,
    generalDeadlines:
      typeof value.generalDeadlines === "boolean"
        ? value.generalDeadlines
        : DEFAULT_NOTIFICATION_PREFERENCES.generalDeadlines,
  };
}

export function normalizeAppDataState(data: Partial<AppDataState> & { savedColleges?: College[] }): AppDataState {
  return {
    user: withDefaultUserState(data.user ?? null),
    questionnaireAnswers: normalizeQuestionnaireAnswers(data.questionnaireAnswers ?? {}),
    notificationsEnabled: data.notificationsEnabled ?? false,
    notificationPreferences: normalizeNotificationPreferences(data.notificationPreferences),
    savedColleges: Array.isArray(data.savedColleges)
      ? savedCollegesService.mergeSavedCollegeLists([], data.savedColleges)
      : [],
  };
}

export function buildFirestoreUserPatch(patch: Partial<User>) {
  const syncPatch: Partial<Record<FirestoreSyncableProfileFieldKey, unknown>> = {};

  for (const key of FIRESTORE_SYNCABLE_PROFILE_FIELD_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(patch, key)) continue;
    const value = patch[key];
    if (value !== undefined) {
      syncPatch[key] = value;
    }
  }

  return syncPatch;
}
