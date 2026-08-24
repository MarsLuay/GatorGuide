import { DEFAULT_USER_STATE } from "@/constants/profile-defaults";
import {
  FIRESTORE_SYNCABLE_PROFILE_FIELD_KEYS,
  STORAGE_KEYS,
  type FirestoreSyncableProfileFieldKey,
} from "@/constants/schema";
import {
  type QuestionnaireAnswers,
} from "@/services/app/questionnaire.enums";
import type { College } from "@/services/colleges/college.service";
import { savedCollegesService } from "@/services/colleges/saved-colleges.service";
import type { PlannerV2State } from "@/hooks/app-data/planner-state-v2";
import {
  createEmptyPlannerV2,
  mirrorOpaqueLegacy,
} from "@/hooks/app-data/planner-state-v2";
import { migrateTransferPlannerLegacyCompletedCourses } from "@/services/planning/transfer-planner-cache.service";

export type { QuestionnaireAnswers } from "@/services/app/questionnaire.enums";

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
  /** Product field until P14 — also mirrored into __legacy. */
  savedColleges: College[];
  /** P13 planner state v2 fields (soft; schema bump deferred). */
  plannerV2: PlannerV2State;
  /** Opaque removal-bound payloads; never deleted on upgrade. */
  __legacy: Record<string, unknown>;
};

export const STORAGE_KEY = STORAGE_KEYS.appData;

export const initialState: AppDataState = {
  user: null,
  questionnaireAnswers: {},
  notificationsEnabled: false,
  notificationPreferences: { ...DEFAULT_NOTIFICATION_PREFERENCES },
  savedColleges: [],
  plannerV2: createEmptyPlannerV2(),
  __legacy: {},
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
  const savedColleges = Array.isArray(data.savedColleges)
    ? savedCollegesService.mergeSavedCollegeLists([], data.savedColleges)
    : [];
  const questionnaireAnswers = migrateTransferPlannerLegacyCompletedCourses(
    data.questionnaireAnswers ?? {}
  );
  const existingLegacy =
    data.__legacy && typeof data.__legacy === "object" && !Array.isArray(data.__legacy)
      ? (data.__legacy as Record<string, unknown>)
      : {};
  const plannerV2 =
    data.plannerV2 && typeof data.plannerV2 === "object"
      ? { ...createEmptyPlannerV2(), ...data.plannerV2 }
      : createEmptyPlannerV2();

  return {
    user: withDefaultUserState(data.user ?? null),
    questionnaireAnswers,
    notificationsEnabled: data.notificationsEnabled ?? false,
    notificationPreferences: normalizeNotificationPreferences(data.notificationPreferences),
    savedColleges,
    plannerV2,
    __legacy: mirrorOpaqueLegacy({
      savedColleges,
      questionnaireAnswers: questionnaireAnswers as Record<string, unknown>,
      existingLegacy,
    }),
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
