import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { QUESTIONNAIRE_FIELD_IDS } from "@/constants/schema";
import type { AuthUser } from "@/services/auth/auth.service";
import type { College } from "@/services/colleges/college.service";
import { errorLoggingService } from "@/services/logging/error-logging.service";
import {
  initialState,
  type AppDataState,
  type NotificationPreferences,
  type QuestionnaireAnswers,
  type User,
} from "./app-data/app-data-state";
import { useAppDataAuthActions } from "./app-data/use-app-data-auth-actions";
import { useAppDataLocalActions } from "./app-data/use-app-data-local-actions";
import {
  useAppDataNotificationActions,
  useAppDataNotificationSync,
} from "./app-data/use-app-data-notifications";
import { useAppDataProfileSync } from "./app-data/use-app-data-profile-sync";
import { useAppDataStorage } from "./app-data/use-app-data-storage";
import { useAppDataUserActions } from "./app-data/use-app-data-user-actions";
import { useSavedCollegeActions } from "./app-data/use-saved-college-actions";
import { useTranscriptReconciliation } from "./app-data/use-transcript-reconciliation";

export type {
  AppDataState,
  NotificationPreferences,
  QuestionnaireAnswers,
  User,
} from "./app-data/app-data-state";
export {
  DEFAULT_NOTIFICATION_PREFERENCES,
  normalizeNotificationPreferences,
} from "./app-data/app-data-state";

type AppDataContextValue = {
  isHydrated: boolean;
  restoreVersion: number;
  state: AppDataState;
  signIn: (user: Pick<User, "name" | "email"> & { password: string; isSignUp: boolean }) => Promise<void>;
  signInWithAuthUser: (authUser: AuthUser) => Promise<void>;
  signInAsGuest: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  patchUserLocally: (patch: Partial<User>) => Promise<void>;
  updateUser: (patch: Partial<User>) => Promise<void>;
  setQuestionnaireAnswers: (
    answers:
      | QuestionnaireAnswers
      | ((currentAnswers: QuestionnaireAnswers) => QuestionnaireAnswers)
  ) => Promise<void>;
  setNotificationsEnabled: (enabled: boolean) => Promise<void>;
  setNotificationPreferences: (patch: Partial<NotificationPreferences>) => Promise<void>;
  addSavedCollege: (college: College) => Promise<void>;
  removeSavedCollege: (collegeId: string) => Promise<void>;
  isCollegeSaved: (collegeId: string) => boolean;
  restoreData: (data: AppDataState) => Promise<void>;
  clearAll: () => Promise<void>;
  setOnboardingSeen: (seen: boolean) => Promise<void>;
};

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [restoreVersion, setRestoreVersion] = useState(0);
  const [state, setState] = useState<AppDataState>(initialState);
  const stateRef = useRef(state);
  const currentDeadlineAnswer =
    state.questionnaireAnswers?.[QUESTIONNAIRE_FIELD_IDS.deadline];
  const currentUserUid = state.user?.uid ?? null;
  const currentUserIsGuest = !!state.user?.isGuest;
  const currentUserTranscript = state.user?.transcript ?? "";

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useAppDataStorage({
    isHydrated,
    setIsHydrated,
    state,
    setState,
  });

  useEffect(() => {
    if (!isHydrated) return;
    void errorLoggingService.flushPendingLogs();
  }, [isHydrated, state.user?.uid]);

  useAppDataNotificationSync({
    isHydrated,
    notificationsEnabled: state.notificationsEnabled,
    transferDeadlinesEnabled: state.notificationPreferences.transferDeadlines,
    deadline: currentDeadlineAnswer,
    setState,
  });

  const {
    reconciledSavedCollegesUidRef,
    loadProfileFromServer,
    loadMergedSavedColleges,
  } = useAppDataProfileSync({
    isHydrated,
    currentUserUid,
    currentUserIsGuest,
    stateRef,
    setState,
  });

  useTranscriptReconciliation({
    isHydrated,
    currentUserUid,
    currentUserTranscript,
    setState,
  });

  const {
    signIn,
    signInWithAuthUser,
    signInAsGuest,
    signOut,
    deleteAccount,
  } = useAppDataAuthActions({
    stateRef,
    setState,
    loadProfileFromServer,
    loadMergedSavedColleges,
    reconciledSavedCollegesUidRef,
  });

  const {
    patchUserLocally,
    updateUser,
    setOnboardingSeen,
  } = useAppDataUserActions({ setState });

  const {
    setQuestionnaireAnswers,
    restoreData,
    clearAll,
  } = useAppDataLocalActions({
    setState,
    setRestoreVersion,
  });

  const {
    setNotificationsEnabled,
    setNotificationPreferences,
  } = useAppDataNotificationActions({ setState });

  const {
    addSavedCollege,
    removeSavedCollege,
    isCollegeSaved,
  } = useSavedCollegeActions({
    state,
    stateRef,
    setState,
  });

  const value = useMemo<AppDataContextValue>(
    () => ({
      isHydrated,
      restoreVersion,
      state,
      signIn,
      signInWithAuthUser,
      signInAsGuest,
      signOut,
      deleteAccount,
      patchUserLocally,
      updateUser,
      setQuestionnaireAnswers,
      setNotificationsEnabled,
      setNotificationPreferences,
      addSavedCollege,
      removeSavedCollege,
      isCollegeSaved,
      restoreData,
      clearAll,
      setOnboardingSeen,
    }),
    [isHydrated, restoreVersion, state, signIn, signInWithAuthUser, signInAsGuest, signOut, deleteAccount, patchUserLocally, updateUser, setQuestionnaireAnswers, setNotificationsEnabled, setNotificationPreferences, addSavedCollege, removeSavedCollege, isCollegeSaved, restoreData, clearAll, setOnboardingSeen]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within <AppDataProvider />");
  return ctx;
}
