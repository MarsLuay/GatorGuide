const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require("@firebase/rules-unit-testing");
const {
  collection,
  doc,
  getDoc,
  setDoc,
} = require("firebase/firestore");
const {
  getBytes,
  ref,
  uploadString,
} = require("firebase/storage");

const projectId = "demo-gatorguide";
const repoRoot = path.resolve(__dirname, "..");
const firestoreRules = fs.readFileSync(path.join(repoRoot, "firestore.rules"), "utf8");
const storageRules = fs.readFileSync(path.join(repoRoot, "storage.rules"), "utf8");

function logStep(label) {
  process.stdout.write(`PASS ${label}\n`);
}

async function run() {
  const testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { rules: firestoreRules },
    storage: { rules: storageRules },
  });

  try {
    await testEnv.clearFirestore();

    const aliceContext = testEnv.authenticatedContext("alice");
    const bobContext = testEnv.authenticatedContext("bob");
    const anonContext = testEnv.unauthenticatedContext();

    const aliceDb = aliceContext.firestore();
    const bobDb = bobContext.firestore();
    const anonDb = anonContext.firestore();

    const aliceStorage = aliceContext.storage();
    const bobStorage = bobContext.storage();
    const anonStorage = anonContext.storage();

    await assertSucceeds(
      setDoc(doc(aliceDb, "users", "alice"), {
        name: "Alice",
        email: "alice@example.com",
        hasSeenOnboarding: false,
      })
    );
    await assertSucceeds(getDoc(doc(aliceDb, "users", "alice")));
    await assertFails(getDoc(doc(anonDb, "users", "alice")));
    await assertFails(getDoc(doc(bobDb, "users", "alice")));
    await assertFails(
      setDoc(doc(bobDb, "users", "alice"), {
        name: "Intruder",
      })
    );
    logStep("users/{uid} owner-only access");

    await assertSucceeds(
      setDoc(doc(aliceDb, "users", "alice", "savedColleges", "100"), {
        collegeId: "100",
        name: "Test College",
        updatedAt: "2026-03-19T00:00:00.000Z",
      })
    );
    await assertFails(getDoc(doc(bobDb, "users", "alice", "savedColleges", "100")));
    await assertFails(
      setDoc(doc(anonDb, "users", "alice", "savedColleges", "101"), {
        collegeId: "101",
        name: "Denied College",
      })
    );
    logStep("users/{uid}/savedColleges owner-only access");

    await assertSucceeds(
      setDoc(doc(aliceDb, "questionnaires", "alice"), {
        userId: "alice",
        answers: { major: "Computer Science" },
        createdAt: "2026-03-19T00:00:00.000Z",
        updatedAt: "2026-03-19T00:00:00.000Z",
      })
    );
    await assertFails(
      setDoc(doc(aliceDb, "questionnaires", "alice"), {
        userId: "bob",
        answers: {},
      })
    );
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "questionnaires", "legacy-alice"), {
        userId: "alice",
        answers: { legacy: true },
      });
    });
    const legacySnapshot = await assertSucceeds(getDoc(doc(aliceDb, "questionnaires", "legacy-alice")));
    assert.equal(legacySnapshot.exists(), true);
    await assertFails(getDoc(doc(bobDb, "questionnaires", "alice")));
    await assertFails(getDoc(doc(anonDb, "questionnaires", "alice")));
    logStep("questionnaires owner-only access and legacy userId fallback");

    await assertSucceeds(
      setDoc(doc(aliceDb, "roadmaps", "alice"), {
        userId: "alice",
        version: 2,
        status: "not_started",
        updatedAt: "2026-03-19T00:00:00.000Z",
      })
    );
    await assertFails(
      setDoc(doc(aliceDb, "roadmaps", "alice"), {
        userId: "bob",
        version: 2,
      })
    );
    await assertFails(getDoc(doc(bobDb, "roadmaps", "alice")));
    await assertFails(getDoc(doc(anonDb, "roadmaps", "alice")));
    logStep("roadmaps owner-only access");

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "opportunities", "green-river-foundation-scholarship"), {
        schemaVersion: 1,
        opportunityId: "green-river-foundation-scholarship",
        type: "scholarship",
        status: "active",
        title: "Green River College Foundation Scholarship",
        organizationName: "Green River College Foundation",
        summary: "Scholarship support for Green River students.",
        externalUrl: "https://grcfoundation.awardspring.com/",
        dueAt: "2026-04-30T16:00:00.000Z",
        recurrence: {
          isYearly: true,
          month: 4,
          day: 30,
          timezone: "America/Los_Angeles",
        },
        deadline: {
          type: "final",
          label: "Annual scholarship deadline",
        },
        matching: {
          financialAidTags: ["need_based", "merit"],
          suggestedMajors: [],
          hasToBeMajor: false,
        },
        eligibility: {
          gpaMin: null,
          residencyTypes: [],
          transferOnly: false,
        },
        requirements: {
          needsRecommendations: true,
          recommendationCountMin: 1,
          essayCount: 3,
        },
        award: {
          amountMin: null,
          amountMax: null,
          currency: "USD",
          amountText: "Amount varies by scholarship award",
          renewable: null,
        },
        college: {
          collegeId: null,
          collegeName: null,
          city: null,
          state: null,
          website: null,
        },
        source: {
          kind: "seed",
          sourceUrl: "https://www.greenriver.edu/students/pay-for-college/financial-aid/types-of-aid/scholarships/",
          sourceLabel: "Green River scholarships page",
          model: null,
          fetchedAt: "2026-03-29T00:00:00.000Z",
          verifiedAt: "2026-03-29T00:00:00.000Z",
        },
        createdAt: "2026-03-29T00:00:00.000Z",
        updatedAt: "2026-03-29T00:00:00.000Z",
      });
    });
    await assertSucceeds(getDoc(doc(aliceDb, "opportunities", "green-river-foundation-scholarship")));
    await assertSucceeds(getDoc(doc(anonDb, "opportunities", "green-river-foundation-scholarship")));
    await assertFails(
      setDoc(doc(aliceDb, "opportunities", "client-created"), {
        schemaVersion: 1,
      })
    );
    logStep("opportunities catalog public-read but client write denied");

    await assertSucceeds(
      setDoc(doc(aliceDb, "users", "alice", "opportunityStatuses", "green-river-foundation-scholarship"), {
        schemaVersion: 1,
        userId: "alice",
        opportunityId: "green-river-foundation-scholarship",
        progress: "submitted",
        progressUpdatedAt: "2026-03-29T00:00:00.000Z",
        isDone: true,
        doneAt: "2026-03-29T00:00:00.000Z",
        doneCycleKey: "2026",
        clientUpdatedAt: "2026-03-29T00:00:00.000Z",
        updatedAt: "2026-03-29T00:00:00.000Z",
      })
    );
    await assertFails(
      setDoc(doc(aliceDb, "users", "alice", "opportunityStatuses", "green-river-foundation-scholarship"), {
        schemaVersion: 1,
        userId: "alice",
        opportunityId: "other-id",
        progress: "submitted",
        progressUpdatedAt: "2026-03-29T00:00:00.000Z",
        isDone: true,
        doneAt: "2026-03-29T00:00:00.000Z",
        doneCycleKey: "2026",
        clientUpdatedAt: "2026-03-29T00:00:00.000Z",
        updatedAt: "2026-03-29T00:00:00.000Z",
      })
    );
    await assertFails(getDoc(doc(bobDb, "users", "alice", "opportunityStatuses", "green-river-foundation-scholarship")));
    await assertFails(
      setDoc(doc(bobDb, "users", "alice", "opportunityStatuses", "green-river-foundation-scholarship"), {
        schemaVersion: 1,
        userId: "alice",
        opportunityId: "green-river-foundation-scholarship",
        progress: "submitted",
        progressUpdatedAt: "2026-03-29T00:00:00.000Z",
        isDone: true,
        doneAt: "2026-03-29T00:00:00.000Z",
        doneCycleKey: "2026",
        clientUpdatedAt: "2026-03-29T00:00:00.000Z",
        updatedAt: "2026-03-29T00:00:00.000Z",
      })
    );
    logStep("users/{uid}/opportunityStatuses owner-only schema access");

    await assertSucceeds(
      setDoc(doc(aliceDb, "chatHistory", "chat-1"), {
        schemaVersion: "2026-03-29.v1",
        sessionId: "chat-1",
        userId: "alice",
        assistantKey: "roadmap-assistant",
        assistantSurface: "roadmap-chat",
        title: "Transfer questions",
        status: "active",
        source: {
          screen: "roadmap-chat",
          route: "/roadmap",
        },
        contextSchemaVersion: "2026-03-19.v1",
        lastOutputFormat: "text",
        messageCount: 1,
        userMessageCount: 1,
        assistantMessageCount: 0,
        latestMessageAt: "2026-03-19T00:00:00.000Z",
        latestMessageRole: "user",
        latestMessagePreview: "What schools fit me best?",
        createdAt: "2026-03-19T00:00:00.000Z",
        updatedAt: "2026-03-19T00:00:00.000Z",
        retention: {
          policy: "ttl_365d",
          expiresAt: "2027-03-19T00:00:00.000Z",
          deleteOnAccountDeletion: true,
        },
      })
    );
    await assertSucceeds(
      setDoc(doc(aliceDb, "chatHistory", "chat-1", "messages", "m1"), {
        schemaVersion: "2026-03-29.v1",
        sessionId: "chat-1",
        messageId: "m1",
        userId: "alice",
        role: "user",
        content: "What schools fit me best?",
        status: "committed",
        source: "client",
        sourceRef: {
          screen: "roadmap-chat",
          route: "/roadmap",
        },
        createdAt: "2026-03-19T00:00:00.000Z",
        clientCreatedAt: "2026-03-19T00:00:00.000Z",
        updatedAt: "2026-03-19T00:00:00.000Z",
        retention: {
          policy: "ttl_365d",
          expiresAt: "2027-03-19T00:00:00.000Z",
          deleteOnAccountDeletion: true,
        },
        modelMetadata: null,
      })
    );
    await assertFails(
      setDoc(doc(aliceDb, "chatHistory", "chat-2"), {
        userId: "alice",
        title: "Missing retention",
      })
    );
    await assertFails(getDoc(doc(bobDb, "chatHistory", "chat-1")));
    await assertFails(
      setDoc(doc(bobDb, "chatHistory", "chat-1", "messages", "m2"), {
        schemaVersion: "2026-03-29.v1",
        sessionId: "chat-1",
        messageId: "m2",
        userId: "bob",
        role: "assistant",
        content: "Denied",
        status: "committed",
        source: "live",
        sourceRef: {
          screen: "roadmap-chat",
          route: "/roadmap",
        },
        createdAt: "2026-03-19T00:00:00.000Z",
        clientCreatedAt: null,
        updatedAt: "2026-03-19T00:00:00.000Z",
        retention: {
          policy: "ttl_365d",
          expiresAt: "2027-03-19T00:00:00.000Z",
          deleteOnAccountDeletion: true,
        },
        modelMetadata: {
          provider: "google",
          model: "gemini",
          gateway: "geminiGateway",
          outputFormat: "text",
          requestId: "req-2",
          contextSchemaVersion: "2026-03-19.v1",
        },
      })
    );
    await assertFails(
      setDoc(doc(aliceDb, "chatHistory", "chat-1", "messages", "m3"), {
        schemaVersion: "2026-03-29.v1",
        sessionId: "wrong-session",
        messageId: "m3",
        userId: "alice",
        role: "assistant",
        content: "Wrong session",
        status: "committed",
        source: "live",
        sourceRef: {
          screen: "roadmap-chat",
          route: "/roadmap",
        },
        createdAt: "2026-03-19T00:00:00.000Z",
        clientCreatedAt: null,
        updatedAt: "2026-03-19T00:00:00.000Z",
        retention: {
          policy: "ttl_365d",
          expiresAt: "2027-03-19T00:00:00.000Z",
          deleteOnAccountDeletion: true,
        },
        modelMetadata: {
          provider: "google",
          model: "gemini",
          gateway: "geminiGateway",
          outputFormat: "text",
          requestId: "req-3",
          contextSchemaVersion: "2026-03-19.v1",
        },
      })
    );
    logStep("chatHistory schema + owner-only access");

    await assertSucceeds(
      setDoc(doc(aliceDb, "supportErrorLogs", "log-1"), {
        userId: "alice",
        message: "Example crash",
        platform: "ios",
        timestamp: "2026-03-19T00:00:00.000Z",
      })
    );
    await assertFails(getDoc(doc(aliceDb, "supportErrorLogs", "log-1")));
    await assertFails(
      setDoc(doc(bobDb, "supportErrorLogs", "log-2"), {
        userId: "alice",
        message: "Spoofed log",
        platform: "android",
        timestamp: "2026-03-19T00:00:00.000Z",
      })
    );
    await assertFails(
      setDoc(doc(anonDb, "supportErrorLogs", "log-3"), {
        userId: "alice",
        message: "Anonymous log",
        platform: "web",
        timestamp: "2026-03-19T00:00:00.000Z",
      })
    );
    logStep("supportErrorLogs write-only authenticated access");

    await assertSucceeds(
      uploadString(ref(aliceStorage, "users/alice/resume/test.txt"), "resume data")
    );
    await assertSucceeds(getBytes(ref(aliceStorage, "users/alice/resume/test.txt"), 1024));
    await assertFails(getBytes(ref(bobStorage, "users/alice/resume/test.txt"), 1024));
    await assertFails(
      uploadString(ref(bobStorage, "users/alice/transcript/forbidden.txt"), "nope")
    );
    await assertFails(
      uploadString(ref(anonStorage, "users/alice/resume/anonymous.txt"), "nope")
    );
    logStep("storage users/{uid}/... owner-only access");

    process.stdout.write("All Firebase rules tests passed.\n");
  } finally {
    await testEnv.cleanup();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
