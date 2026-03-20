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

    await assertSucceeds(
      setDoc(doc(aliceDb, "chatHistory", "chat-1"), {
        userId: "alice",
        title: "Transfer questions",
        createdAt: "2026-03-19T00:00:00.000Z",
      })
    );
    await assertSucceeds(
      setDoc(doc(aliceDb, "chatHistory", "chat-1", "messages", "m1"), {
        role: "user",
        text: "What schools fit me best?",
      })
    );
    await assertFails(getDoc(doc(bobDb, "chatHistory", "chat-1")));
    await assertFails(
      setDoc(doc(bobDb, "chatHistory", "chat-1", "messages", "m2"), {
        role: "assistant",
        text: "Denied",
      })
    );
    logStep("chatHistory owner-only access");

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
