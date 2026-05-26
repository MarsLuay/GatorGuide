import * as DocumentPicker from "expo-document-picker";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Platform } from "react-native";

import { ROUTES } from "@/constants/routes";
import { TRANSFER_PLANNER_LEGACY_COMPLETED_COURSES_FIELD } from "@/constants/planner-storage";
import type { QuestionnaireAnswers, User } from "@/hooks/use-app-data";
import { useAppLanguage } from "@/hooks/use-app-language";
import { errorLoggingService } from "@/services/logging/error-logging.service";
import {
  buildTransferPlannerTranscriptCachePatch,
  TRANSCRIPT_COURSES_FIELD,
  TRANSCRIPT_EARNED_CREDITS_FIELD,
  TRANSCRIPT_PARSER_VERSION,
  TRANSCRIPT_PARSER_VERSION_FIELD,
  TRANSCRIPT_FIELD,
  TRANSCRIPT_UPLOADED_AT_FIELD,
} from "@/services/planning/transfer-planner-cache.service";
import { resetTranscriptState } from "@/services/planning/transcript-reset.service";
import { parseCompletedTranscriptCourses } from "@/services/planning/transfer-planner.service";
import { storageService } from "@/services/storage/storage.service";

import {
  appendTranscriptDebugEvent,
  buildFriendlyTranscriptError,
  buildParsedCourseAssignmentsPreview,
  buildParsedQuarterBuckets,
  buildTranscriptDebugSnapshot,
  getDebugElapsedMs,
  getDebugNowMs,
  getReadableTranscriptFileName,
  getTranscriptAnalysisAttemptKey,
  getTranscriptDocumentIdentity,
  getTranscriptUrlKind,
} from "./transfer-planner-transcript-debug";
import {
  CTCLINK_UNOFFICIAL_TRANSCRIPT_URL,
  openExternalLink,
} from "./transfer-planner-linking";
import type { TranscriptDocument } from "./transfer-planner-storage";
import { transcriptPlannerDebugService } from "@/services/dev/transcript-planner-debug.service";

type SetQuestionnaireAnswers = (
  answers:
    | QuestionnaireAnswers
    | ((currentAnswers: QuestionnaireAnswers) => QuestionnaireAnswers)
) => Promise<void>;

type UseTranscriptPlannerStateInput = {
  user: User | null;
  questionnaireAnswers: QuestionnaireAnswers;
  patchUserLocally: (patch: Partial<User>) => Promise<void>;
  updateUser: (patch: Partial<User>) => Promise<void>;
  setQuestionnaireAnswers: SetQuestionnaireAnswers;
};

function getDocumentPickerSourceFile(asset: DocumentPicker.DocumentPickerAsset) {
  const maybeFile = (asset as DocumentPicker.DocumentPickerAsset & { file?: Blob | null })
    .file;
  return Platform.OS === "web" && typeof Blob !== "undefined" && maybeFile instanceof Blob
    ? maybeFile
    : null;
}

export function useTranscriptPlannerState({
  user,
  questionnaireAnswers,
  patchUserLocally,
  updateUser,
  setQuestionnaireAnswers,
}: UseTranscriptPlannerStateInput) {
  const { t } = useAppLanguage();
  const [transcriptDocument, setTranscriptDocument] = useState<TranscriptDocument | null>(null);
  const [isAnalyzingTranscript, setIsAnalyzingTranscript] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const transcriptAnalysisAttemptsRef = useRef<Set<string>>(new Set());
  const transcriptAnalysisGenerationRef = useRef(0);

  const storedDetailedTranscriptCourses = questionnaireAnswers[TRANSCRIPT_COURSES_FIELD];
  const hasDetailedCompletedCourses = useMemo(
    () =>
      Array.isArray(storedDetailedTranscriptCourses) &&
      storedDetailedTranscriptCourses.some(
        (entry: unknown) => !!entry && typeof entry === "object" && !Array.isArray(entry)
      ),
    [storedDetailedTranscriptCourses]
  );
  const hasDetailedCompletedCourseCredits = useMemo(
    () =>
      Array.isArray(storedDetailedTranscriptCourses) &&
      storedDetailedTranscriptCourses.some((entry: unknown) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
          return false;
        }

        const record = entry as Record<string, unknown>;
        const credits = Number(
          record.credits ?? record.earnedCredits ?? record.credit
        );
        return Number.isFinite(credits) && credits > 0;
      }),
    [storedDetailedTranscriptCourses]
  );
  const storedTranscriptSource = String(
    questionnaireAnswers[TRANSCRIPT_FIELD] ?? ""
  ).trim();
  const storedTranscriptUploadedAt = useMemo(() => {
    const raw = String(questionnaireAnswers[TRANSCRIPT_UPLOADED_AT_FIELD] ?? "").trim();
    if (!raw) return "";

    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString();
  }, [questionnaireAnswers]);
  const storedTranscriptParserVersion = useMemo(() => {
    const raw = questionnaireAnswers[TRANSCRIPT_PARSER_VERSION_FIELD];
    const parsed =
      typeof raw === "number" ? raw : Number.parseInt(String(raw ?? "").trim(), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }, [questionnaireAnswers]);
  const shouldUseDetailedCompletedCourses =
    hasDetailedCompletedCourses &&
    storedTranscriptParserVersion === TRANSCRIPT_PARSER_VERSION;
  const storedTranscriptEarnedCredits = useMemo(() => {
    const parsed = Number(questionnaireAnswers[TRANSCRIPT_EARNED_CREDITS_FIELD]);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [questionnaireAnswers]);
  const cachedTranscriptDocument = useMemo<TranscriptDocument | null>(() => {
    if (!shouldUseDetailedCompletedCourses) return null;

    const url = storedTranscriptSource || String(user?.transcript ?? "").trim();
    if (!url) return null;

    return {
      name: "unofficial-transcript.pdf",
      url,
      uploadedAt: storedTranscriptUploadedAt,
      mimeType: "application/pdf",
      sizeBytes: null,
    };
  }, [
    shouldUseDetailedCompletedCourses,
    storedTranscriptSource,
    storedTranscriptUploadedAt,
    user?.transcript,
  ]);
  const activeTranscriptDocument = transcriptDocument ?? cachedTranscriptDocument;
  const legacyCompletedCourseAnswers =
    questionnaireAnswers[TRANSFER_PLANNER_LEGACY_COMPLETED_COURSES_FIELD];
  const rawCompletedCourses = shouldUseDetailedCompletedCourses
    ? storedDetailedTranscriptCourses
    : legacyCompletedCourseAnswers;
  const completedCourses = useMemo(
    () => parseCompletedTranscriptCourses(rawCompletedCourses),
    [rawCompletedCourses]
  );
  const transcriptDerivedCompletedCourses = useMemo(
    () =>
      shouldUseDetailedCompletedCourses
        ? parseCompletedTranscriptCourses(storedDetailedTranscriptCourses)
        : [],
    [shouldUseDetailedCompletedCourses, storedDetailedTranscriptCourses]
  );
  const needsTranscriptCreditReparse =
    shouldUseDetailedCompletedCourses &&
    storedTranscriptEarnedCredits == null &&
    !hasDetailedCompletedCourseCredits &&
    !!activeTranscriptDocument;
  const needsTranscriptReparse =
    hasDetailedCompletedCourses &&
    (storedTranscriptParserVersion !== TRANSCRIPT_PARSER_VERSION ||
      needsTranscriptCreditReparse);
  const transcriptSourceKey = getTranscriptDocumentIdentity(activeTranscriptDocument);
  const transcriptAnalysisKey = transcriptSourceKey
    ? `${transcriptSourceKey}|v${TRANSCRIPT_PARSER_VERSION}`
    : "";

  useEffect(() => {
    let active = true;

    if (!user?.uid) {
      setTranscriptDocument((currentDocument) => {
        if (!currentDocument) return currentDocument;
        transcriptAnalysisGenerationRef.current += 1;
        return null;
      });
      return () => {
        active = false;
      };
    }

    void (async () => {
      const stored = await storageService.getTranscript(user.uid).catch(() => null);
      if (!active) return;
      const nextDocument = stored && stored.url ? stored : null;
      setTranscriptDocument((currentDocument) => {
        if (
          getTranscriptDocumentIdentity(currentDocument) ===
          getTranscriptDocumentIdentity(nextDocument)
        ) {
          return currentDocument;
        }

        transcriptAnalysisGenerationRef.current += 1;
        return nextDocument;
      });
    })();

    return () => {
      active = false;
    };
  }, [user?.uid, user?.transcript]);

  const analyzeTranscript = useCallback(
    async (document: TranscriptDocument) => {
      const analysisStartedAt = getDebugNowMs();
      let importMs = 0;
      let parserRunMs = 0;
      let cachePatchMs = 0;
      let parserDiagnostics: unknown = null;
      const analysisAttemptKey = getTranscriptAnalysisAttemptKey(document);
      const analysisGeneration = transcriptAnalysisGenerationRef.current;
      if (analysisAttemptKey) {
        transcriptAnalysisAttemptsRef.current.add(analysisAttemptKey);
      }
      setIsAnalyzingTranscript(true);
      setTranscriptError(null);
      appendTranscriptDebugEvent("transcript-analysis-start", analysisStartedAt, {
        documentName: getReadableTranscriptFileName(document),
        urlKind: getTranscriptUrlKind(document.url),
        urlLength: String(document.url ?? "").length,
        sizeBytes: document.sizeBytes ?? null,
        storedParserVersion: storedTranscriptParserVersion,
        parserVersion: TRANSCRIPT_PARSER_VERSION,
      });
      const debugBase = {
        document,
        parserVersion: TRANSCRIPT_PARSER_VERSION,
        storedParserVersion: storedTranscriptParserVersion,
        transcriptSourceKey: getTranscriptDocumentIdentity(document),
        storedTranscriptSource,
        completedCoursesBeforeCount: completedCourses.length,
        questionnaireCompletedCourseCount: Array.isArray(legacyCompletedCourseAnswers)
          ? legacyCompletedCourseAnswers.length
          : 0,
      };

      transcriptPlannerDebugService.setLastTranscriptPlannerDebug(
        buildTranscriptDebugSnapshot({
          ...debugBase,
          phase: "analysis-start",
          parsedCourseCount: null,
          parsedCourseCodesPreview: [],
          parsedCourseAssignmentsPreview: [],
          parsedQuarterBuckets: [],
          timings: {
            analysisElapsedMs: 0,
          },
          parserDiagnostics: null,
          error: null,
        })
      );

      try {
        const importStartedAt = getDebugNowMs();
        const { transcriptPdfService } = await import(
          "@/services/documents/transcript-pdf.service"
        );
        importMs = getDebugElapsedMs(importStartedAt);
        appendTranscriptDebugEvent("transcript-parser-module-imported", analysisStartedAt, {
          importMs,
        });

        const parserStartedAt = getDebugNowMs();
        const parsedTranscript = await transcriptPdfService.extractTranscriptDataFromPdf(
          document.url
        );
        parserRunMs = getDebugElapsedMs(parserStartedAt);
        parserDiagnostics = parsedTranscript.diagnostics ?? null;
        appendTranscriptDebugEvent("transcript-parser-complete", analysisStartedAt, {
          parserRunMs,
          parserDiagnostics,
          parsedCourseCount: parsedTranscript.completedCourses.length,
          earnedCreditsTotal: parsedTranscript.earnedCreditsTotal,
          gpa: parsedTranscript.gpa,
        });
        const parsedCourses = parsedTranscript.completedCourses;

        if (!parsedCourses.length) throw new Error("No completed courses extracted.");
        if (analysisGeneration !== transcriptAnalysisGenerationRef.current) return;

        const cachePatchStartedAt = getDebugNowMs();
        await setQuestionnaireAnswers((currentAnswers) => ({
          ...currentAnswers,
          ...buildTransferPlannerTranscriptCachePatch(
            document,
            parsedCourses,
            parsedTranscript.earnedCreditsTotal
          ),
        }));
        cachePatchMs = getDebugElapsedMs(cachePatchStartedAt);
        appendTranscriptDebugEvent("transcript-cache-patch-applied", analysisStartedAt, {
          cachePatchMs,
          parsedCourseCount: parsedCourses.length,
        });

        transcriptPlannerDebugService.setLastTranscriptPlannerDebug(
          buildTranscriptDebugSnapshot({
            ...debugBase,
            phase: "analysis-success",
            parsedCourseCount: parsedCourses.length,
            parsedCourseCodesPreview: parsedCourses
              .slice(0, 20)
              .map((course) => course.code),
            parsedCourseAssignmentsPreview: buildParsedCourseAssignmentsPreview(parsedCourses),
            parsedQuarterBuckets: buildParsedQuarterBuckets(parsedCourses),
            timings: {
              analysisElapsedMs: getDebugElapsedMs(analysisStartedAt),
              importMs,
              parserRunMs,
              cachePatchMs,
            },
            parserDiagnostics,
            error: null,
          })
        );
      } catch (error) {
        if (analysisGeneration !== transcriptAnalysisGenerationRef.current) return;
        appendTranscriptDebugEvent("transcript-analysis-failure", analysisStartedAt, {
          analysisElapsedMs: getDebugElapsedMs(analysisStartedAt),
          importMs,
          parserRunMs,
          cachePatchMs,
          message: error instanceof Error ? error.message : String(error),
        });
        const failureSnapshot = buildTranscriptDebugSnapshot({
          ...debugBase,
          phase: "analysis-failure",
          parsedCourseCount: null,
          parsedCourseCodesPreview: [],
          parsedCourseAssignmentsPreview: [],
          parsedQuarterBuckets: [],
          timings: {
            analysisElapsedMs: getDebugElapsedMs(analysisStartedAt),
            importMs,
            parserRunMs,
            cachePatchMs,
          },
          parserDiagnostics,
          error,
        });

        transcriptPlannerDebugService.setLastTranscriptPlannerDebug(failureSnapshot);
        void errorLoggingService.captureException(error, {
          category: "storage",
          operation: "transfer-planner-analyze-transcript",
          severity: "warn",
          handled: true,
          source: "TransferPlannerPage",
          screen: "TransferPlannerPage",
          route: ROUTES.transferPlanner,
          tags: ["transcript", "transfer-planner", failureSnapshot.document.urlKind],
          metadata: failureSnapshot,
        });
        setTranscriptError(buildFriendlyTranscriptError(t));
      } finally {
        if (analysisGeneration === transcriptAnalysisGenerationRef.current) {
          appendTranscriptDebugEvent("transcript-analysis-finished", analysisStartedAt, {
            analysisElapsedMs: getDebugElapsedMs(analysisStartedAt),
            importMs,
            parserRunMs,
            cachePatchMs,
          });
          setIsAnalyzingTranscript(false);
        }
      }
    },
    [
      completedCourses.length,
      legacyCompletedCourseAnswers,
      setQuestionnaireAnswers,
      storedTranscriptParserVersion,
      storedTranscriptSource,
      t,
    ]
  );

  useEffect(() => {
    if (!activeTranscriptDocument) return;
    const autoAnalysisStartedAt = getDebugNowMs();
    if (
      completedCourses.length &&
      storedTranscriptSource === activeTranscriptDocument.url &&
      shouldUseDetailedCompletedCourses &&
      !needsTranscriptCreditReparse
    ) {
      appendTranscriptDebugEvent("transcript-auto-analysis-skipped-cache-fresh", autoAnalysisStartedAt, {
        completedCoursesCount: completedCourses.length,
        storedParserVersion: storedTranscriptParserVersion,
        parserVersion: TRANSCRIPT_PARSER_VERSION,
      });
      return;
    }
    if (!transcriptAnalysisKey) return;
    if (transcriptAnalysisAttemptsRef.current.has(transcriptAnalysisKey)) {
      appendTranscriptDebugEvent("transcript-auto-analysis-skipped-duplicate-key", autoAnalysisStartedAt, {
        transcriptAnalysisKeyLength: transcriptAnalysisKey.length,
        needsTranscriptReparse,
        needsTranscriptCreditReparse,
        isAnalyzingTranscript,
      });
      return;
    }

    transcriptAnalysisAttemptsRef.current.add(transcriptAnalysisKey);
    appendTranscriptDebugEvent("transcript-auto-analysis-dispatched", autoAnalysisStartedAt, {
      transcriptAnalysisKeyLength: transcriptAnalysisKey.length,
      urlKind: getTranscriptUrlKind(activeTranscriptDocument.url),
      urlLength: String(activeTranscriptDocument.url ?? "").length,
      needsTranscriptReparse,
      needsTranscriptCreditReparse,
    });
    void analyzeTranscript(activeTranscriptDocument);
  }, [
    activeTranscriptDocument,
    analyzeTranscript,
    transcriptAnalysisKey,
    completedCourses.length,
    isAnalyzingTranscript,
    storedTranscriptSource,
    storedTranscriptParserVersion,
    shouldUseDetailedCompletedCourses,
    needsTranscriptReparse,
    needsTranscriptCreditReparse,
  ]);

  const handlePickTranscript = useCallback(async () => {
    if (!user?.uid) {
      Alert.alert(
        t("transferPlanner.profileNeededAlertTitle"),
        t("transferPlanner.profileNeededAlertBody")
      );
      return;
    }

    const uploadFlowStartedAt = getDebugNowMs();
    transcriptPlannerDebugService.clearTranscriptPlannerEvents();
    appendTranscriptDebugEvent("transcript-upload-flow-start", uploadFlowStartedAt, {
      userId: user.uid,
      platform: Platform.OS,
    });

    try {
      const pickerStartedAt = getDebugNowMs();
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf"],
        copyToCacheDirectory: true,
      });
      appendTranscriptDebugEvent("transcript-document-picker-complete", uploadFlowStartedAt, {
        pickerMs: getDebugElapsedMs(pickerStartedAt),
        canceled: result.canceled,
        assetCount: result.assets?.length ?? 0,
      });

      if (result.canceled || !result.assets?.[0]?.uri) {
        appendTranscriptDebugEvent("transcript-upload-flow-canceled", uploadFlowStartedAt);
        return;
      }

      const asset = result.assets[0];
      appendTranscriptDebugEvent("transcript-document-selected", uploadFlowStartedAt, {
        fileName: asset.name ?? null,
        uriKind: getTranscriptUrlKind(asset.uri),
        uriLength: String(asset.uri ?? "").length,
        mimeType: asset.mimeType ?? null,
        sizeBytes: asset.size ?? null,
        hasWebSourceFile: !!getDocumentPickerSourceFile(asset),
      });

      const localPersistStartedAt = getDebugNowMs();
      const uploaded = await storageService.uploadTranscript(user.uid, asset.uri, {
        fileName: asset.name,
        mimeType: asset.mimeType,
        sizeBytes: asset.size,
        sourceFile: getDocumentPickerSourceFile(asset),
      });
      appendTranscriptDebugEvent("transcript-local-persist-complete", uploadFlowStartedAt, {
        localPersistMs: getDebugElapsedMs(localPersistStartedAt),
        persistedUrlKind: getTranscriptUrlKind(uploaded.url),
        persistedUrlLength: String(uploaded.url ?? "").length,
        uploadedAt: uploaded.uploadedAt,
      });

      const updateUserStartedAt = getDebugNowMs();
      await updateUser({ transcript: uploaded.url });
      appendTranscriptDebugEvent("transcript-user-state-update-complete", uploadFlowStartedAt, {
        updateUserMs: getDebugElapsedMs(updateUserStartedAt),
      });

      transcriptAnalysisGenerationRef.current += 1;
      transcriptAnalysisAttemptsRef.current.add(getTranscriptAnalysisAttemptKey(uploaded));
      setTranscriptDocument(uploaded);
      appendTranscriptDebugEvent("transcript-analysis-dispatched-after-upload", uploadFlowStartedAt);
      await analyzeTranscript(uploaded);
      appendTranscriptDebugEvent("transcript-upload-flow-finished", uploadFlowStartedAt, {
        totalUploadFlowMs: getDebugElapsedMs(uploadFlowStartedAt),
      });
    } catch (error) {
      appendTranscriptDebugEvent("transcript-upload-flow-failure", uploadFlowStartedAt, {
        totalUploadFlowMs: getDebugElapsedMs(uploadFlowStartedAt),
        message: error instanceof Error ? error.message : String(error),
      });
      transcriptPlannerDebugService.setLastTranscriptPlannerDebug(
        buildTranscriptDebugSnapshot({
          phase: "upload-failure",
          document: {
            name: "unofficial-transcript.pdf",
            url: "",
            uploadedAt: "",
            mimeType: "application/pdf",
            sizeBytes: null,
          },
          parserVersion: TRANSCRIPT_PARSER_VERSION,
          storedParserVersion: storedTranscriptParserVersion,
          transcriptSourceKey: "",
          storedTranscriptSource,
          completedCoursesBeforeCount: completedCourses.length,
          questionnaireCompletedCourseCount: Array.isArray(legacyCompletedCourseAnswers)
            ? legacyCompletedCourseAnswers.length
            : 0,
          parsedCourseCount: null,
          parsedCourseCodesPreview: [],
          parsedCourseAssignmentsPreview: [],
          parsedQuarterBuckets: [],
          timings: {
            totalUploadFlowMs: getDebugElapsedMs(uploadFlowStartedAt),
          },
          parserDiagnostics: null,
          error,
        })
      );
      void errorLoggingService.captureException(error, {
        category: "upload",
        operation: "transfer-planner-upload-transcript",
        severity: "warn",
        handled: true,
        source: "TransferPlannerPage",
        screen: "TransferPlannerPage",
        route: ROUTES.transferPlanner,
        tags: ["transcript", "transfer-planner", "upload"],
      });
      Alert.alert(t("transferPlanner.transcriptUploadFailedTitle"), t("transferPlanner.transcriptUploadFailedBody"), [
        {
          text: t("general.cancel"),
          style: "cancel",
        },
        {
          text: t("transferPlanner.openCtcLink"),
          onPress: () => {
            void openExternalLink(CTCLINK_UNOFFICIAL_TRANSCRIPT_URL);
          },
        },
      ]);
    }
  }, [
    analyzeTranscript,
    completedCourses.length,
    legacyCompletedCourseAnswers,
    storedTranscriptParserVersion,
    storedTranscriptSource,
    t,
    updateUser,
    user?.uid,
  ]);

  const removeTranscriptNow = useCallback(async () => {
    if (!user?.uid) return;

    try {
      transcriptAnalysisGenerationRef.current += 1;
      setTranscriptDocument(null);
      transcriptAnalysisAttemptsRef.current.clear();
      setTranscriptError(null);
      setIsAnalyzingTranscript(false);

      await resetTranscriptState({
        userId: user.uid,
        setQuestionnaireAnswers,
        patchUserLocally,
        updateUser,
      });
    } catch (err) {
      const restoredTranscript = await storageService.getTranscript(user.uid).catch(() => null);
      transcriptAnalysisGenerationRef.current += 1;
      setTranscriptDocument(restoredTranscript && restoredTranscript.url ? restoredTranscript : null);
      void errorLoggingService.captureException(err, {
        category: "storage",
        operation: "delete-transcript",
        severity: "warn",
        handled: true,
        source: "TransferPlannerPage",
      });

      if (Platform.OS === "web" && typeof window !== "undefined" && typeof window.alert === "function") {
        window.alert(t("transferPlanner.removeFailedBody"));
      } else {
        Alert.alert(t("transferPlanner.removeFailedTitle"), t("transferPlanner.removeFailedBody"));
      }
    }
  }, [patchUserLocally, setQuestionnaireAnswers, t, updateUser, user?.uid]);

  const handleRemoveTranscript = useCallback(() => {
    void removeTranscriptNow();
  }, [removeTranscriptNow]);

  return {
    activeTranscriptDocument,
    isAnalyzingTranscript,
    transcriptError,
    completedCourses,
    transcriptDerivedCompletedCourses,
    shouldUseDetailedCompletedCourses,
    needsTranscriptReparse,
    storedTranscriptParserVersion,
    storedTranscriptSource,
    handlePickTranscript,
    handleRemoveTranscript,
  };
}
