import { useEffect, type Dispatch, type SetStateAction } from "react";
import { storageService } from "@/services/storage/storage.service";
import type { AppDataState } from "./app-data-state";

type UseTranscriptReconciliationArgs = {
  isHydrated: boolean;
  currentUserUid: string | null;
  currentUserTranscript: string;
  setState: Dispatch<SetStateAction<AppDataState>>;
};

export function useTranscriptReconciliation({
  isHydrated,
  currentUserUid,
  currentUserTranscript,
  setState,
}: UseTranscriptReconciliationArgs) {
  useEffect(() => {
    if (!isHydrated) return;
    if (!currentUserUid) return;

    let cancelled = false;
    void (async () => {
      const localTranscript = await storageService.getTranscript(currentUserUid).catch(() => null);
      const nextTranscriptUrl = localTranscript?.url ?? "";

      if (cancelled) return;
      setState((prev) => {
        if (!prev.user || prev.user.uid !== currentUserUid) return prev;
        if (String(prev.user.transcript ?? "") === nextTranscriptUrl) return prev;
        return {
          ...prev,
          user: {
            ...prev.user,
            transcript: nextTranscriptUrl,
          },
        };
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [isHydrated, currentUserUid, currentUserTranscript, setState]);
}
