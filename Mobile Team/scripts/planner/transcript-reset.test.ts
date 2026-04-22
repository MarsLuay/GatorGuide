import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { transcriptPlannerDebugService } from "@/services/dev/transcript-planner-debug.service";
import { clearTransferPlannerTranscriptCache } from "@/services/planning/transfer-planner-cache.service";
import { resetTranscriptState } from "@/services/planning/transcript-reset.service";

test("Transcript cache reset removes transcript-derived completed planner courses", () => {
  const nextQuestionnaireAnswers = clearTransferPlannerTranscriptCache({
    completedCourses: ["MATH& 151 Calculus I"],
    transferPlannerCompletedCourses: [
      {
        code: "MATH& 151",
        label: "MATH& 151 Calculus I",
      },
    ],
    transferPlannerTranscriptSource: "file:///tmp/transcript.pdf",
    transferPlannerTranscriptUploadedAt: "2026-04-21T01:02:03.000Z",
    transferPlannerTranscriptParserVersion: 2,
    major: "Computer Science",
  });

  assert.equal("completedCourses" in nextQuestionnaireAnswers, false);
  assert.equal("transferPlannerCompletedCourses" in nextQuestionnaireAnswers, false);
  assert.equal("transferPlannerTranscriptSource" in nextQuestionnaireAnswers, false);
  assert.equal("transferPlannerTranscriptUploadedAt" in nextQuestionnaireAnswers, false);
  assert.equal("transferPlannerTranscriptParserVersion" in nextQuestionnaireAnswers, false);
});

test("Transcript cache reset preserves unrelated planner preferences and profile data", () => {
  const nextQuestionnaireAnswers = clearTransferPlannerTranscriptCache({
    completedCourses: ["ENGL& 101 English Composition"],
    transferPlannerCompletedCourses: [
      {
        code: "ENGL& 101",
        label: "ENGL& 101 English Composition",
      },
    ],
    transferPlannerTranscriptSource: "file:///tmp/transcript.pdf",
    transferPlannerCurrentCoursesByPath: {
      "uw-seattle::computer-science::base": ["CSE 123"],
    },
    transferPlannerSelectedPathwayByPlan: {
      "uw-seattle-computer-science": "base",
    },
    transferPlannerLastSelectedPlan: {
      collegeId: "uw",
      campusId: "uw-seattle",
      majorId: "uw-seattle-computer-science",
    },
    major: "Computer Science",
    gpa: "3.9",
  });

  assert.deepEqual(nextQuestionnaireAnswers.transferPlannerCurrentCoursesByPath, {
    "uw-seattle::computer-science::base": ["CSE 123"],
  });
  assert.deepEqual(nextQuestionnaireAnswers.transferPlannerSelectedPathwayByPlan, {
    "uw-seattle-computer-science": "base",
  });
  assert.deepEqual(nextQuestionnaireAnswers.transferPlannerLastSelectedPlan, {
    collegeId: "uw",
    campusId: "uw-seattle",
    majorId: "uw-seattle-computer-science",
  });
  assert.equal(nextQuestionnaireAnswers.major, "Computer Science");
  assert.equal(nextQuestionnaireAnswers.gpa, "3.9");
});

test("Shared transcript reset clears transcript reference, planner cache, and debug snapshot", async () => {
  const deleteTranscriptCalls: string[] = [];
  const localUserPatches: Record<string, unknown>[] = [];
  const updateUserPatches: Record<string, unknown>[] = [];
  let nextQuestionnaireAnswers: Record<string, unknown> | null = null;

  transcriptPlannerDebugService.setLastTranscriptPlannerDebug({
    timestamp: "2026-04-21T00:00:00.000Z",
    phase: "analysis-success",
    document: {
      name: "transcript.pdf",
      displayName: "transcript.pdf",
      urlKind: "file-url",
      urlLength: 24,
      mimeType: "application/pdf",
      sizeBytes: 1024,
      uploadedAt: "2026-04-21T00:00:00.000Z",
    },
    parserVersion: 2,
    storedParserVersion: 2,
    transcriptSourceKey: "file:///tmp/transcript.pdf|2026-04-21T00:00:00.000Z",
    storedTranscriptSource: "file:///tmp/transcript.pdf",
    completedCoursesBeforeCount: 4,
    questionnaireCompletedCourseCount: 4,
    parsedCourseCount: 4,
    parsedCourseCodesPreview: ["MATH& 151"],
    parsedCourseAssignmentsPreview: [],
    parsedQuarterBuckets: [],
    error: null,
  });

  await resetTranscriptState({
    userId: "student-1",
    deleteTranscriptFile: async (userId) => {
      deleteTranscriptCalls.push(userId);
    },
    patchUserLocally: async (patch) => {
      localUserPatches.push(patch as Record<string, unknown>);
    },
    updateUser: async (patch) => {
      updateUserPatches.push(patch as Record<string, unknown>);
    },
    setQuestionnaireAnswers: async (answers) => {
      nextQuestionnaireAnswers =
        typeof answers === "function"
          ? answers({
              completedCourses: ["MATH& 151 Calculus I"],
              transferPlannerCompletedCourses: [
                {
                  code: "MATH& 151",
                  label: "MATH& 151 Calculus I",
                },
              ],
              transferPlannerTranscriptSource: "file:///tmp/transcript.pdf",
              transferPlannerCurrentCoursesByPath: {
                "uw-seattle::computer-science::base": ["CSE 123"],
              },
            })
          : answers;
    },
  });

  assert.deepEqual(deleteTranscriptCalls, ["student-1"]);
  assert.deepEqual(localUserPatches, [{ transcript: "" }]);
  assert.deepEqual(updateUserPatches, [{ transcript: "" }]);
  assert.equal(nextQuestionnaireAnswers?.["completedCourses"], undefined);
  assert.equal(nextQuestionnaireAnswers?.["transferPlannerCompletedCourses"], undefined);
  assert.equal(nextQuestionnaireAnswers?.["transferPlannerTranscriptSource"], undefined);
  assert.deepEqual(nextQuestionnaireAnswers?.["transferPlannerCurrentCoursesByPath"], {
    "uw-seattle::computer-science::base": ["CSE 123"],
  });
  assert.equal(transcriptPlannerDebugService.getLastTranscriptPlannerDebug(), null);
});

test("Shared transcript reset still clears local transcript and planner cache when remote cleanup fails", async () => {
  const localUserPatches: Record<string, unknown>[] = [];
  let nextQuestionnaireAnswers: Record<string, unknown> | null = null;

  await resetTranscriptState({
    userId: "student-2",
    deleteTranscriptFile: async () => {},
    patchUserLocally: async (patch) => {
      localUserPatches.push(patch as Record<string, unknown>);
    },
    updateUser: async () => {
      throw new Error("remote transcript cleanup failed");
    },
    setQuestionnaireAnswers: async (answers) => {
      nextQuestionnaireAnswers =
        typeof answers === "function"
          ? answers({
              completedCourses: ["MATH& 151 Calculus I"],
              transferPlannerCompletedCourses: [
                {
                  code: "MATH& 151",
                  label: "MATH& 151 Calculus I",
                },
              ],
              transferPlannerTranscriptSource: "file:///tmp/transcript.pdf",
            })
          : answers;
    },
  });

  assert.deepEqual(localUserPatches, [{ transcript: "" }]);
  assert.equal(nextQuestionnaireAnswers?.["completedCourses"], undefined);
  assert.equal(nextQuestionnaireAnswers?.["transferPlannerCompletedCourses"], undefined);
  assert.equal(nextQuestionnaireAnswers?.["transferPlannerTranscriptSource"], undefined);
});

test("Clear cache now and Remove Transcript both use the shared transcript reset logic", () => {
  const settingsPage = readFileSync("components/pages/SettingsPage.tsx", "utf8");
  const transferPlannerPage = readFileSync("components/pages/TransferPlannerPage.tsx", "utf8");

  assert.match(settingsPage, /import\s+\{\s*resetTranscriptState\s*\}\s+from\s+"@\/services\/planning\/transcript-reset\.service"/);
  assert.match(settingsPage, /await\s+resetTranscriptState\(\{/);
  assert.match(settingsPage, /patchUserLocally,/);
  assert.match(transferPlannerPage, /import\s+\{\s*resetTranscriptState\s*\}\s+from\s+"@\/services\/planning\/transcript-reset\.service"/);
  assert.match(transferPlannerPage, /await\s+resetTranscriptState\(\{/);
  assert.match(transferPlannerPage, /patchUserLocally,/);
});

test("Planner transcript removal still clears the local transcript document state so transcript messaging can disappear", () => {
  const transferPlannerPage = readFileSync("components/pages/TransferPlannerPage.tsx", "utf8");

  assert.match(transferPlannerPage, /if\s*\(!transcriptDocument\)\s*\{/);
  assert.match(transferPlannerPage, /Transcript-based course plan/);
  assert.match(transferPlannerPage, /setTranscriptDocument\(null\);/);
  assert.match(
    transferPlannerPage,
    /const\s+removeTranscriptNow\s*=\s*useCallback\(async\s*\(\)\s*=>[\s\S]*setTranscriptDocument\(null\);[\s\S]*await\s+resetTranscriptState\(\{/
  );
});

test("Planner transcript removal invalidates in-flight transcript analysis before reset", () => {
  const transferPlannerPage = readFileSync("components/pages/TransferPlannerPage.tsx", "utf8");

  assert.match(transferPlannerPage, /const\s+transcriptAnalysisGenerationRef\s*=\s*useRef\(0\);/);
  assert.match(
    transferPlannerPage,
    /const\s+analysisGeneration\s*=\s*transcriptAnalysisGenerationRef\.current;[\s\S]*if\s*\(analysisGeneration\s*!==\s*transcriptAnalysisGenerationRef\.current\)\s*return;/
  );
  assert.match(
    transferPlannerPage,
    /transcriptAnalysisGenerationRef\.current\s*\+=\s*1;[\s\S]*setTranscriptDocument\(null\);[\s\S]*await\s+resetTranscriptState\(\{/
  );
});

test("Planner transcript removal uses a web confirm fallback before running the shared reset", () => {
  const transferPlannerPage = readFileSync("components/pages/TransferPlannerPage.tsx", "utf8");

  assert.match(
    transferPlannerPage,
    /Platform\.OS\s*===\s*"web"[\s\S]*window\.confirm[\s\S]*void\s+removeTranscriptNow\(\);/
  );
});
