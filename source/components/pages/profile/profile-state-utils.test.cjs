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

const {
  buildProfileDraftPatch,
  formatProfileGpaDisplay,
  formatProfileStateDisplayValue,
  getProfileGpaInputState,
  getReadableDocumentFileName,
  hasProfileGpaValue,
  normalizeEditableProfileSnapshot,
  omitProfileReviewField,
  omitQuestionnaireReviewField,
  resolveProfileStateName,
} = require("@/components/pages/profile/profile-state-utils");

test("profile state helpers normalize abbreviations, names, and readable fallbacks", () => {
  assert.equal(resolveProfileStateName("wa"), "Washington");
  assert.equal(resolveProfileStateName(" new   mexico "), "New Mexico");
  assert.equal(formatProfileStateDisplayValue("northwest territory"), "Northwest Territory");
  assert.equal(formatProfileStateDisplayValue("DC"), "District of Columbia");
});

test("document display names avoid encoded blobs and recover readable URL names", () => {
  assert.equal(
    getReadableDocumentFileName({
      name: "Unofficial Transcript.pdf",
      url: "file:///private/raw",
      fallbackName: "fallback.pdf",
    }),
    "Unofficial Transcript.pdf"
  );

  assert.equal(
    getReadableDocumentFileName({
      name: "data:application/pdf;base64,AAAA",
      url: "file:///docs/Unofficial%20Transcript.pdf?download=1",
      fallbackName: "fallback.pdf",
    }),
    "Unofficial Transcript.pdf"
  );

  assert.equal(
    getReadableDocumentFileName({
      url: "blob:https://example.test/123",
      fallbackName: "fallback.pdf",
    }),
    "fallback.pdf"
  );
});

test("GPA helpers match profile and setup input constraints", () => {
  assert.equal(hasProfileGpaValue("  "), false);
  assert.equal(hasProfileGpaValue("0"), true);
  assert.equal(formatProfileGpaDisplay("3.999"), "3.99");
  assert.equal(formatProfileGpaDisplay("4.008"), "4");
  assert.equal(formatProfileGpaDisplay("-1"), "0");

  assert.equal(getProfileGpaInputState("").accepted, true);
  assert.equal(getProfileGpaInputState("0.").accepted, true);
  assert.equal(getProfileGpaInputState("3.99").accepted, true);
  assert.equal(getProfileGpaInputState("4").accepted, true);
  assert.equal(getProfileGpaInputState("4.0").accepted, false);
  assert.equal(getProfileGpaInputState("3.999").accepted, false);
  assert.equal(getProfileGpaInputState("abc").accepted, false);
});

test("normalizeEditableProfileSnapshot canonicalizes autosaved profile drafts", () => {
  const majorLookup = new Map([["computer science", "Computer Science"]]);
  const normalized = normalizeEditableProfileSnapshot(
    {
      name: "Ada",
      state: "wa",
      major: "computer science",
      gender: "woman",
      gpa: "3.999",
      transcript: "file:///transcript.pdf",
      residencyType: "inState",
    },
    majorLookup
  );

  assert.deepEqual(normalized, {
    name: "Ada",
    state: "Washington",
    major: "Computer Science",
    gender: "woman",
    gpa: "3.99",
    transcript: "file:///transcript.pdf",
    residencyType: "inState",
  });

  assert.deepEqual(
    buildProfileDraftPatch(normalized, {
      ...normalized,
      gpa: "3.9",
      transcript: "",
    }),
    {
      gpa: "3.99",
      transcript: "file:///transcript.pdf",
    }
  );
});

function buildReview() {
  return {
    fileName: "transcript.pdf",
    confidence: 0.8,
    userPatch: {
      gpa: "3.6",
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
  };
}

test("document review helpers remove only the already-owned field", () => {
  const withoutGpa = omitProfileReviewField(buildReview(), "gpa");
  assert.equal(withoutGpa.userPatch.gpa, undefined);
  assert.equal(withoutGpa.userPatch.major, "Biology");
  assert.deepEqual(
    withoutGpa.items.map((item) => `${item.target}:${item.id}`),
    ["profile:major", "questionnaire:completedCourses"]
  );

  const withoutCompletedCourses = omitQuestionnaireReviewField(
    buildReview(),
    "completedCourses"
  );
  assert.equal(withoutCompletedCourses.questionnairePatch.completedCourses, undefined);
  assert.equal(withoutCompletedCourses.questionnairePatch.location, "Washington");
  assert.deepEqual(
    withoutCompletedCourses.items.map((item) => `${item.target}:${item.id}`),
    ["profile:gpa", "profile:major"]
  );
});
