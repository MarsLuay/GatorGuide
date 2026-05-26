require("ts-node").register({
  skipProject: true,
  transpileOnly: true,
  compilerOptions: {
    module: "CommonJS",
    moduleResolution: "node",
    jsx: "react-jsx",
    baseUrl: ".",
    paths: {
      "@/*": ["./*"],
    },
  },
});
require("tsconfig-paths/register");

const assert = require("node:assert/strict");
const test = require("node:test");
const Module = require("node:module");

let documentPickerResult = {
  canceled: false,
  assets: [
    {
      uri: "file:///cache/transcript.pdf",
      name: "Transcript.pdf",
      mimeType: "application/pdf",
      size: 2048,
    },
  ],
};
let documentPickerOptions = null;
let uploadedTranscriptArgs = null;
let parsedTranscript = {
  completedCourses: ["ENGL& 101"],
  earnedCreditsTotal: 5,
  gpa: "3.85",
};
let roadmapRequest = null;

const originalLoad = Module._load;
Module._load = function loadWithProfileDocumentWorkflowMocks(request, parent, isMain) {
  if (request === "expo-document-picker") {
    return {
      getDocumentAsync: async (options) => {
        documentPickerOptions = options;
        return documentPickerResult;
      },
    };
  }

  if (request === "react-native") {
    return {
      Platform: {
        OS: "native",
      },
    };
  }

  if (request === "@/services/documents/document-reader.service") {
    return {
      documentReaderService: {
        extractDocumentReview: async (input) => ({
          fileName: input.fileName,
          confidence: 0.9,
          userPatch: { gpa: "3.7" },
          questionnairePatch: {},
          items: [{ id: "gpa", target: "profile", labelKey: "profile.gpa" }],
          uncertainties: [],
        }),
      },
    };
  }

  if (request === "@/services/documents/transcript-pdf.service") {
    return {
      transcriptPdfService: {
        extractTranscriptDataFromPdf: async () => parsedTranscript,
      },
    };
  }

  if (request === "@/services/planning/roadmap.service") {
    return {
      roadmapService: {
        ensureUserRoadmap: async (_userId, request) => {
          roadmapRequest = request;
        },
      },
    };
  }

  if (request === "@/services/planning/transfer-planner-cache.service") {
    return {
      buildTransferPlannerTranscriptCachePatch: (uploaded, courses, credits) => ({
        transcriptUrl: uploaded.url,
        transferPlannerCompletedCourses: courses.join(","),
        transferPlannerEarnedCredits: credits,
      }),
    };
  }

  if (request === "@/services/storage/storage.service") {
    return {
      storageService: {
        uploadTranscript: async (...args) => {
          uploadedTranscriptArgs = args;
          return {
            name: args[2].fileName,
            url: "file:///documents/transcript.pdf",
            uploadedAt: "2026-05-25T00:00:00.000Z",
            mimeType: args[2].mimeType,
            sizeBytes: args[2].sizeBytes,
          };
        },
      },
    };
  }

  return originalLoad.call(this, request, parent, isMain);
};

const {
  ensureProfileSetupRoadmap,
  extractProfileTranscriptDocumentReview,
  pickProfileTranscriptDocument,
  prepareTranscriptDocumentReview,
  syncUploadedTranscriptToPlanner,
  uploadProfileTranscriptDocument,
} = require("@/components/pages/profile/profile-document-workflow");

test("pickProfileTranscriptDocument centralizes picker options and selected document shape", async () => {
  const selected = await pickProfileTranscriptDocument();

  assert.equal(documentPickerOptions.copyToCacheDirectory, true);
  assert.ok(documentPickerOptions.type.includes("application/pdf"));
  assert.ok(documentPickerOptions.type.includes("image/webp"));
  assert.deepEqual(selected, {
    uri: "file:///cache/transcript.pdf",
    name: "Transcript.pdf",
    mimeType: "application/pdf",
    size: 2048,
    sourceFile: null,
  });
});

test("pickProfileTranscriptDocument returns null when the user cancels", async () => {
  documentPickerResult = {
    canceled: true,
    assets: [],
  };

  assert.equal(await pickProfileTranscriptDocument(), null);

  documentPickerResult = {
    canceled: false,
    assets: [
      {
        uri: "file:///cache/transcript.pdf",
        name: "Transcript.pdf",
        mimeType: "application/pdf",
        size: 2048,
      },
    ],
  };
});

test("prepareTranscriptDocumentReview removes owned GPA and completed-course items", () => {
  const prepared = prepareTranscriptDocumentReview({
    omitCompletedCoursesReview: true,
    removeGpa: true,
    review: {
      fileName: "Transcript.pdf",
      confidence: 0.8,
      userPatch: {
        gpa: "3.5",
        major: "Biology",
      },
      questionnairePatch: {
        completedCourses: "ENGL& 101",
        location: "Washington",
      },
      items: [
        { id: "gpa", target: "profile", labelKey: "profile.gpa" },
        { id: "major", target: "profile", labelKey: "profile.major" },
        {
          id: "completedCourses",
          target: "questionnaire",
          labelKey: "questionnaire.completedCourses",
        },
      ],
      uncertainties: [],
    },
  });

  assert.equal(prepared.userPatch.gpa, undefined);
  assert.equal(prepared.userPatch.major, "Biology");
  assert.equal(prepared.questionnairePatch.completedCourses, undefined);
  assert.deepEqual(
    prepared.items.map((item) => `${item.target}:${item.id}`),
    ["profile:major"]
  );
});

test("uploadProfileTranscriptDocument delegates local transcript persistence", async () => {
  const uploaded = await uploadProfileTranscriptDocument("user-1", {
    uri: "file:///cache/transcript.pdf",
    name: "Transcript.pdf",
    mimeType: "application/pdf",
    size: 2048,
  });

  assert.equal(uploaded.url, "file:///documents/transcript.pdf");
  assert.deepEqual(uploadedTranscriptArgs, [
    "user-1",
    "file:///cache/transcript.pdf",
    {
      fileName: "Transcript.pdf",
      mimeType: "application/pdf",
      sizeBytes: 2048,
      sourceFile: undefined,
    },
  ]);
});

test("extractProfileTranscriptDocumentReview passes selected document and current profile context", async () => {
  const review = await extractProfileTranscriptDocumentReview({
    currentProfile: {
      major: "Computer Science",
      gpa: "3.4",
    },
    document: {
      uri: "file:///cache/transcript.pdf",
      name: "Transcript.pdf",
      mimeType: "application/pdf",
      size: 2048,
    },
    questionnaireAnswers: {
      location: "washington_only",
    },
  });

  assert.equal(review.fileName, "Transcript.pdf");
  assert.equal(review.userPatch.gpa, "3.7");
});

test("syncUploadedTranscriptToPlanner writes planner cache patch and applies transcript GPA", async () => {
  const questionnaireWrites = [];
  const gpaWrites = [];

  const count = await syncUploadedTranscriptToPlanner({
    applyTranscriptGpa: async (...args) => {
      gpaWrites.push(args);
      return true;
    },
    setQuestionnaireAnswers: async (updater) => {
      questionnaireWrites.push(updater({ existing: "value" }));
    },
    uploaded: {
      name: "Transcript.pdf",
      url: "file:///documents/transcript.pdf",
      uploadedAt: "2026-05-25T00:00:00.000Z",
      mimeType: "application/pdf",
      sizeBytes: 2048,
    },
  });

  assert.equal(count, 1);
  assert.deepEqual(questionnaireWrites, [
    {
      existing: "value",
      transcriptUrl: "file:///documents/transcript.pdf",
      transferPlannerCompletedCourses: "ENGL& 101",
      transferPlannerEarnedCredits: 5,
    },
  ]);
  assert.deepEqual(gpaWrites, [["3.85", "auto-apply-transcript-pdf-gpa"]]);
});

test("ensureProfileSetupRoadmap centralizes post-profile planning request shape", async () => {
  await ensureProfileSetupRoadmap({
    gpa: "3.8",
    major: "Computer Science",
    questionnaireAnswers: {
      location: "washington_only",
    },
    savedCollegeNames: ["UW Tacoma"],
    transcriptFileName: "Transcript.pdf",
    userId: "user-1",
  });

  assert.deepEqual(roadmapRequest, {
    major: "Computer Science",
    gpa: "3.8",
    questionnaireAnswers: {
      location: "washington_only",
    },
    targetSchools: ["UW Tacoma"],
    documents: {
      transcripts: {
        fileName: "Transcript.pdf",
      },
    },
  });
});
