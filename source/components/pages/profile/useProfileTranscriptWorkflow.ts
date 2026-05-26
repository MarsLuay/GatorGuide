import { useEffect, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { Alert } from "react-native";

import { ROUTES } from "@/constants/routes";
import { normalizeQuestionnaireAnswers } from "@/services/app/questionnaire.enums";
import type { QuestionnaireAnswers, User } from "@/hooks/use-app-data";
import { collegeService } from "@/services/colleges/college.service";
import type { DocumentExtractionReview } from "@/services/documents/document-reader.service";
import { errorLoggingService } from "@/services/logging/error-logging.service";
import type { Language } from "@/services/app/translations";
import {
  extractProfileTranscriptDocumentReview,
  pickProfileTranscriptDocument,
  prepareTranscriptDocumentReview,
  syncUploadedTranscriptToPlanner,
  uploadProfileTranscriptDocument,
  type SelectedProfileDocument,
} from "@/components/pages/profile/profile-document-workflow";
import {
  formatProfileGpaDisplay,
  getReadableDocumentFileName,
  hasProfileGpaValue,
  omitProfileReviewField,
  type EditableProfileSnapshot,
} from "@/components/pages/profile/profile-state-utils";

type Translate = (key: string, params?: Record<string, string | number>) => string;

type UploadedDocumentMeta = {
  name: string;
  url: string;
};

type UseProfileTranscriptWorkflowOptions = {
  editData: EditableProfileSnapshot;
  isHydrated: boolean;
  language: Language;
  latestProfileGpaRef: MutableRefObject<string>;
  questionnaireAnswers: QuestionnaireAnswers;
  setEditData: Dispatch<SetStateAction<EditableProfileSnapshot>>;
  setQuestionnaireAnswers: (
    answers:
      | QuestionnaireAnswers
      | ((currentAnswers: QuestionnaireAnswers) => QuestionnaireAnswers)
  ) => Promise<void>;
  t: Translate;
  updateUser: (patch: Partial<User>) => Promise<void>;
  user: User | null;
};

export function useProfileTranscriptWorkflow({
  editData,
  isHydrated,
  language,
  latestProfileGpaRef,
  questionnaireAnswers,
  setEditData,
  setQuestionnaireAnswers,
  t,
  updateUser,
  user,
}: UseProfileTranscriptWorkflowOptions) {
  const [uploadedDocumentMeta, setUploadedDocumentMeta] = useState<
    Partial<Record<"transcript", UploadedDocumentMeta>>
  >({});
  const [activeDocumentAnalysis, setActiveDocumentAnalysis] = useState<"transcript" | null>(null);
  const [documentReviews, setDocumentReviews] = useState<
    Partial<Record<"transcript", DocumentExtractionReview>>
  >({});

  useEffect(() => {
    let cancelled = false;

    if (!user?.uid) {
      setUploadedDocumentMeta({});
      return;
    }

    void (async () => {
      try {
        const { storageService } = await import("@/services/storage/storage.service");
        const transcriptDocument = await storageService.getTranscript(user.uid);

        if (cancelled) return;

        setUploadedDocumentMeta({
          ...(transcriptDocument
            ? { transcript: { name: transcriptDocument.name, url: transcriptDocument.url } }
            : {}),
        });
      } catch {
        if (!cancelled) {
          setUploadedDocumentMeta({});
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.uid, user?.transcript]);

  useEffect(() => {
    if (!hasProfileGpaValue(editData.gpa || user?.gpa)) return;

    setDocumentReviews((current) => {
      const review = current.transcript;
      const hasGpaPatch = typeof review?.userPatch.gpa === "string";
      const hasGpaItem = review?.items.some(
        (item) => item.target === "profile" && item.id === "gpa"
      );
      if (!review || (!hasGpaPatch && !hasGpaItem)) return current;
      const nextReview = omitProfileReviewField(review, "gpa");

      return nextReview.items.length ? { ...current, transcript: nextReview } : {};
    });
  }, [editData.gpa, user?.gpa]);

  const transcriptDisplayName = (path: string | undefined) =>
    getReadableDocumentFileName({
      name:
        uploadedDocumentMeta.transcript?.url === String(path ?? "")
          ? uploadedDocumentMeta.transcript?.name
          : null,
      url: path,
      fallbackName: "unofficial-transcript.pdf",
    });

  const autoApplyTranscriptGpa = async (
    rawGpa: string | null | undefined,
    operation: string
  ) => {
    const transcriptGpa = formatProfileGpaDisplay(rawGpa);
    if (!transcriptGpa || hasProfileGpaValue(latestProfileGpaRef.current)) {
      return false;
    }

    const previousGpa = latestProfileGpaRef.current;
    try {
      latestProfileGpaRef.current = transcriptGpa;
      await updateUser({ gpa: transcriptGpa });
      setEditData((prev) =>
        hasProfileGpaValue(prev.gpa) ? prev : { ...prev, gpa: transcriptGpa }
      );
      return true;
    } catch (error) {
      latestProfileGpaRef.current = previousGpa || editData.gpa || user?.gpa || "";
      void errorLoggingService.captureException(error, {
        category: "firestore",
        operation,
        severity: "warn",
        handled: true,
        source: "profile-page",
        screen: "profile",
        route: ROUTES.profile,
      });
      return false;
    }
  };

  const syncUploadedTranscriptToPlannerForProfile = async (
    uploaded: Awaited<ReturnType<typeof uploadProfileTranscriptDocument>>
  ) => {
    if (!uploaded) return 0;
    try {
      return await syncUploadedTranscriptToPlanner({
        applyTranscriptGpa: autoApplyTranscriptGpa,
        setQuestionnaireAnswers,
        uploaded,
      });
    } catch (error) {
      void errorLoggingService.captureException(error, {
        category: "upload",
        operation: "sync-profile-transcript-to-planner",
        severity: "warn",
        handled: true,
        source: "profile-page",
        screen: "profile",
        route: ROUTES.profile,
      });
      return 0;
    }
  };

  const analyzeUploadedDocument = async (
    selectedDocument: SelectedProfileDocument,
    options?: { omitCompletedCoursesReview?: boolean }
  ) => {
    setActiveDocumentAnalysis("transcript");
    try {
      const review = await extractProfileTranscriptDocumentReview({
        document: selectedDocument,
        currentProfile: {
          major: editData.major || user?.major || "",
          gpa: editData.gpa || user?.gpa || "",
        },
        questionnaireAnswers,
      });
      const transcriptGpa = review.userPatch.gpa;
      let removeGpa = false;

      if (transcriptGpa) {
        const didAutoApplyTranscriptGpa = await autoApplyTranscriptGpa(
          transcriptGpa,
          "auto-apply-transcript-gpa"
        );

        if (didAutoApplyTranscriptGpa || hasProfileGpaValue(latestProfileGpaRef.current)) {
          removeGpa = true;
        }
      }

      const nextReview = prepareTranscriptDocumentReview({
        omitCompletedCoursesReview: options?.omitCompletedCoursesReview,
        removeGpa,
        review,
      });
      setDocumentReviews(nextReview ? { transcript: nextReview } : {});
    } catch (error) {
      Alert.alert(
        t("profile.documentReaderUnavailableTitle"),
        error instanceof Error ? error.message : t("profile.prepareDataError")
      );
    } finally {
      setActiveDocumentAnalysis(null);
    }
  };

  const dismissDocumentReview = () => {
    setDocumentReviews({});
  };

  const applyDocumentReview = async () => {
    const review = documentReviews.transcript;
    if (!review || !user?.uid) return;

    try {
      const userPatch = { ...review.userPatch };
      if (hasProfileGpaValue(latestProfileGpaRef.current)) {
        delete userPatch.gpa;
      }

      if (Object.keys(userPatch).length) {
        if (userPatch.gpa) {
          latestProfileGpaRef.current = userPatch.gpa;
        }
        setEditData((prev) => ({ ...prev, ...userPatch }));
        await updateUser(userPatch);
      }

      if (Object.keys(review.questionnairePatch).length) {
        const nextQuestionnaire = normalizeQuestionnaireAnswers(
          {
            ...questionnaireAnswers,
            ...review.questionnairePatch,
          },
          language
        ) as Record<string, string>;
        await setQuestionnaireAnswers(nextQuestionnaire);
        try {
          await collegeService.saveQuestionnaireResult(nextQuestionnaire);
        } catch (error) {
          void errorLoggingService.captureException(error, {
            category: "firestore",
            operation: "apply-document-review-questionnaire-sync",
            severity: "warn",
            handled: true,
            source: "profile-page",
            screen: "profile",
            route: ROUTES.profile,
          });
        }
      }

      dismissDocumentReview();
      Alert.alert(t("profile.documentReaderAppliedTitle"), t("profile.documentReaderAppliedMessage"));
    } catch (error) {
      void errorLoggingService.captureException(error, {
        category: "upload",
        operation: "apply-document-review",
        severity: "error",
        handled: true,
        source: "profile-page",
        screen: "profile",
        route: ROUTES.profile,
      });
      Alert.alert(t("general.error"), t("profile.prepareDataError"));
    }
  };

  const handlePickTranscript = async () => {
    if (!user?.uid || !isHydrated) return;
    try {
      const selectedDocument = await pickProfileTranscriptDocument();
      if (!selectedDocument) return;
      const uploaded = await uploadProfileTranscriptDocument(user.uid, selectedDocument);
      if (!uploaded) return;
      await updateUser({ transcript: uploaded.url });
      setEditData((prev) => ({ ...prev, transcript: uploaded.url }));
      setUploadedDocumentMeta((current) => ({
        ...current,
        transcript: { name: uploaded.name, url: uploaded.url },
      }));
      const syncedCompletedCourseCount = await syncUploadedTranscriptToPlannerForProfile(uploaded);
      await analyzeUploadedDocument(selectedDocument, {
        omitCompletedCoursesReview: syncedCompletedCourseCount > 0,
      });
    } catch (error) {
      void errorLoggingService.captureException(error, {
        category: "upload",
        operation: "pick-transcript",
        severity: "error",
        handled: true,
        source: "profile-page",
        screen: "profile",
        route: ROUTES.profile,
      });
      Alert.alert(t("general.error"), t("profile.prepareDataError"));
    }
  };

  return {
    activeDocumentAnalysis,
    applyDocumentReview,
    dismissDocumentReview,
    documentReviews,
    handlePickTranscript,
    transcriptDisplayName,
  };
}
