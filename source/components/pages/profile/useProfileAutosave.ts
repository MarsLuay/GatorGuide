import { useEffect, useMemo, type Dispatch, type SetStateAction } from "react";

import { ROUTES } from "@/constants/routes";
import type { User } from "@/hooks/use-app-data";
import { errorLoggingService } from "@/services/logging/error-logging.service";
import {
  buildProfileDraftPatch,
  normalizeEditableProfileSnapshot,
  type EditableProfileSnapshot,
} from "@/components/pages/profile/profile-state-utils";

type ProfileMajorLookup = {
  get: (key: string) => string | undefined;
};

type UseProfileAutosaveOptions = {
  editData: EditableProfileSnapshot;
  greenRiverMajorLookup: ProfileMajorLookup;
  isHydrated: boolean;
  setEditData: Dispatch<SetStateAction<EditableProfileSnapshot>>;
  updateUser: (patch: Partial<User>) => Promise<void>;
  user: User | null;
};

export function useProfileAutosave({
  editData,
  greenRiverMajorLookup,
  isHydrated,
  setEditData,
  updateUser,
  user,
}: UseProfileAutosaveOptions) {
  const normalizedProfileDraft = useMemo<EditableProfileSnapshot>(() => {
    return normalizeEditableProfileSnapshot(editData, greenRiverMajorLookup);
  }, [editData, greenRiverMajorLookup]);

  const persistedProfileDraft = useMemo<EditableProfileSnapshot>(() => {
    return normalizeEditableProfileSnapshot({
      name: String(user?.name ?? ""),
      state: String(user?.state ?? ""),
      major: String(user?.major ?? ""),
      gender: String(user?.gender ?? ""),
      gpa: String(user?.gpa ?? ""),
      transcript: String(user?.transcript ?? ""),
      residencyType: String(user?.residencyType ?? ""),
    }, greenRiverMajorLookup);
  }, [
    greenRiverMajorLookup,
    user?.gender,
    user?.gpa,
    user?.major,
    user?.name,
    user?.residencyType,
    user?.state,
    user?.transcript,
  ]);

  const profileDraftPatch = useMemo<Partial<EditableProfileSnapshot>>(() => {
    return buildProfileDraftPatch(normalizedProfileDraft, persistedProfileDraft);
  }, [normalizedProfileDraft, persistedProfileDraft]);

  useEffect(() => {
    if (!isHydrated || !user) return;
    if (!Object.keys(profileDraftPatch).length) return;

    const autoSaveTimer = setTimeout(() => {
      void (async () => {
        try {
          await updateUser(profileDraftPatch);

          if (
            typeof profileDraftPatch.gpa === "string" &&
            editData.gpa !== normalizedProfileDraft.gpa
          ) {
            setEditData((prev) =>
              prev.gpa === normalizedProfileDraft.gpa
                ? prev
                : { ...prev, gpa: normalizedProfileDraft.gpa }
            );
          }
        } catch (error) {
          void errorLoggingService.captureException(error, {
            category: "firestore",
            operation: "auto-save-profile-edit",
            severity: "error",
            handled: true,
            source: "profile-page",
            screen: "profile",
            route: ROUTES.profile,
          });
        }
      })();
    }, 600);

    return () => {
      clearTimeout(autoSaveTimer);
    };
  }, [
    editData.gpa,
    isHydrated,
    normalizedProfileDraft.gpa,
    profileDraftPatch,
    setEditData,
    updateUser,
    user,
  ]);
}
