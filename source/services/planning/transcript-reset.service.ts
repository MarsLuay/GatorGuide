import type { QuestionnaireAnswers, User } from "@/hooks/use-app-data";
import { transcriptPlannerDebugService } from "@/services/dev/transcript-planner-debug.service";
import { clearTransferPlannerTranscriptCache } from "@/services/planning/transfer-planner-cache.service";

type SetQuestionnaireAnswers = (
  answers:
    | QuestionnaireAnswers
    | ((currentAnswers: QuestionnaireAnswers) => QuestionnaireAnswers)
) => Promise<void>;

type UpdateUser = (patch: Partial<User>) => Promise<void>;

type ResetTranscriptStateArgs = {
  userId: string;
  setQuestionnaireAnswers: SetQuestionnaireAnswers;
  patchUserLocally?: UpdateUser;
  updateUser: UpdateUser;
  deleteTranscriptFile?: (userId: string) => Promise<void>;
  clearDebugSnapshot?: () => void;
};

async function deleteStoredTranscriptFile(userId: string) {
  const { storageService } = await import("@/services/storage/storage.service");
  await storageService.deleteFile(userId, "transcript");
}

export async function resetTranscriptState({
  userId,
  setQuestionnaireAnswers,
  patchUserLocally,
  updateUser,
  deleteTranscriptFile = deleteStoredTranscriptFile,
  clearDebugSnapshot = () => transcriptPlannerDebugService.setLastTranscriptPlannerDebug(null),
}: ResetTranscriptStateArgs) {
  await deleteTranscriptFile(userId);
  if (patchUserLocally) {
    await patchUserLocally({ transcript: "" });
  }
  await setQuestionnaireAnswers((currentAnswers) =>
    clearTransferPlannerTranscriptCache(currentAnswers)
  );
  clearDebugSnapshot();
  try {
    await updateUser({ transcript: "" });
  } catch {
    // Transcript persistence is local-only in practice, so a remote legacy-field cleanup
    // failure should not block the local transcript reset flow.
  }
}
