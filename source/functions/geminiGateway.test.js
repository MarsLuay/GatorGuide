const assert = require("node:assert/strict");
const test = require("node:test");
const { HttpsError } = require("firebase-functions/v2/https");
const { __test } = require("./geminiGateway");

class FakeSnapshot {
  constructor(data) {
    this.data = data ?? null;
    this.exists = !!data;
  }

  get(field) {
    return this.data?.[field];
  }
}

class FakeDocRef {
  constructor(db, pathParts) {
    this.db = db;
    this.path = pathParts.join("/");
  }

  collection(name) {
    return {
      doc: (id) => new FakeDocRef(this.db, [this.path, name, id]),
    };
  }

  async update(data) {
    this.db.directUpdates.push({ type: "update", path: this.path, data });
  }
}

class FakeFirestore {
  constructor(initialDocs = {}) {
    this.docs = new Map(Object.entries(initialDocs));
    this.transactionOps = [];
    this.directUpdates = [];
  }

  collection(name) {
    return {
      doc: (id) => new FakeDocRef(this, [name, id]),
    };
  }

  async runTransaction(callback) {
    const transaction = {
      get: async (ref) => new FakeSnapshot(this.docs.get(ref.path)),
      set: (ref, data) => {
        this.transactionOps.push({ type: "set", path: ref.path, data });
        this.docs.set(ref.path, data);
      },
      update: (ref, data) => {
        this.transactionOps.push({ type: "update", path: ref.path, data });
        this.docs.set(ref.path, { ...(this.docs.get(ref.path) ?? {}), ...data });
      },
    };

    await callback(transaction);
  }
}

function buildConfig(overrides = {}) {
  return {
    authDailyUnitsLimit: 8,
    globalDailyUnitsLimit: 10,
    guestDailyUnitsLimit: 5,
    recommendBatchSize: 2,
    maxCandidatesPerRequest: 4,
    ...overrides,
  };
}

function buildIdentity(overrides = {}) {
  return {
    authUid: null,
    clientInstanceId: "client-1",
    clientKeyHash: "client-hash",
    scope: "guest",
    ...overrides,
  };
}

test("Gemini prompt inputs are bounded before template rendering", () => {
  const colleges = Array.from({ length: 10 }, (_, index) => ({
    id: `college-${index}`,
    name: `College ${index} ${"x".repeat(300)}`,
    location: { city: "c".repeat(200), state: "Washington".repeat(20) },
    reason: "good fit ".repeat(80),
    programs: Array.from({ length: 20 }, (__, programIndex) =>
      `Program ${programIndex} ${"p".repeat(220)}`
    ),
  }));

  const { input, promptTemplate } = __test.buildChatAssistantPrompt({
    query: "q".repeat(__test.MAX_CHAT_MESSAGE_CHARS + 200),
    context: { notes: "n".repeat(20000) },
    outputFormat: "please-ignore-json",
    topRankedColleges: colleges,
  });

  assert.equal(input.query.length, __test.MAX_CHAT_MESSAGE_CHARS);
  assert.equal(input.outputFormat, "text");
  assert.equal(input.topRankedColleges.length, __test.MAX_ASSISTANT_COLLEGES);
  assert.equal(input.topRankedColleges[0].name.length, 160);
  assert.equal(input.topRankedColleges[0].reason.length, 220);
  assert.equal(input.topRankedColleges[0].programs.length, __test.MAX_PROGRAMS_PER_COLLEGE);
  assert.ok(input.topRankedColleges[0].programs.every((program) => program.length <= 120));
  assert.match(promptTemplate.prompt, /Prompt template: chat-assistant@/);
  assert.doesNotMatch(promptTemplate.prompt, /college-7/);
});

test("Gemini sanitizers reject oversized documents and candidate batches", () => {
  assert.throws(
    () =>
      __test.sanitizeDocumentExtractionInput({
        documentType: "transcript",
        mimeType: "application/pdf",
        fileBase64: "x".repeat(__test.MAX_DOCUMENT_BASE64_CHARS + 1),
      }),
    (error) => error instanceof HttpsError && error.code === "invalid-argument"
  );

  assert.throws(
    () =>
      __test.sanitizeRecommendInput(
        {
          colleges: Array.from({ length: 5 }, (_, index) => ({
            id: `college-${index}`,
            name: "College",
          })),
        },
        buildConfig({ maxCandidatesPerRequest: 4 })
      ),
    (error) => error instanceof HttpsError && error.code === "invalid-argument"
  );
});

test("Gemini document extraction responses keep only supported bounded fields", () => {
  const response = __test.sanitizeDocumentExtractionResponse(
    {
      documentType: "transcript-and-resume".repeat(4),
      extractedFields: {
        completedCourses: {
          value: Array.from({ length: 25 }, (_, index) => `COURSE ${index} ${"x".repeat(150)}`),
          sourceSnippet: "s".repeat(400),
          confidence: 120,
        },
        unsupported: {
          value: "should be dropped",
        },
      },
      uncertainties: Array.from({ length: 12 }, (_, index) => `uncertain ${index} ${"u".repeat(400)}`),
      confidence: 999,
    },
    "transcript"
  );

  assert.equal(response.documentType.length, 40);
  assert.equal(response.extractedFields.completedCourses.value.length, 20);
  assert.ok(
    response.extractedFields.completedCourses.value.every((item) => item.length <= 120)
  );
  assert.equal(response.extractedFields.completedCourses.sourceSnippet.length, 240);
  assert.equal(response.extractedFields.completedCourses.confidence, 100);
  assert.equal(response.uncertainties.length, 8);
  assert.equal(response.confidence, 100);
  assert.equal(response.extractedFields.unsupported, undefined);
});

test("Gemini quota reservation accounts for allowed attempts and finalized usage", async () => {
  const fakeDb = new FakeFirestore();
  const reservation = await __test.reserveUsage(
    buildConfig(),
    "recommendFactors",
    2,
    buildIdentity(),
    fakeDb
  );

  assert.equal(reservation.allowed, true);
  assert.equal(reservation.units, 2);
  assert.equal(reservation.clientRemaining, 3);
  assert.equal(reservation.globalRemaining, 8);
  assert.equal(fakeDb.transactionOps.length, 2);
  assert.ok(fakeDb.transactionOps.every((operation) => operation.type === "set"));
  assert.ok(fakeDb.transactionOps.every((operation) => operation.data.units === 2));

  await __test.finalizeUsage(
    reservation,
    {
      status: "success",
      usage: { promptTokens: 4, candidateTokens: 6, totalTokens: 10 },
      responseMs: 123,
      model: "gemini-test",
      promptTemplate: {
        id: "recommend-factor-scoring",
        version: "v1",
        libraryVersion: "test-lib",
      },
    },
    fakeDb
  );

  assert.equal(fakeDb.directUpdates.length, 2);
  const update = fakeDb.directUpdates[0].data;
  assert.ok(Object.hasOwn(update, "successes"));
  assert.ok(Object.hasOwn(update, "actions.recommendFactors.successes"));
  assert.ok(Object.hasOwn(update, "actions.recommendFactors.totalTokens"));
  assert.equal(update.lastModel, "gemini-test");
  assert.equal(update.lastPromptTemplateId, "recommend-factor-scoring");
});

test("Gemini quota reservation records denied global and client attempts", async () => {
  const dateKey = new Date().toISOString().slice(0, 10);
  const globalPath = `aiUsageDaily/${dateKey}`;
  const clientPath = `${globalPath}/clients/client-hash`;
  const fakeDb = new FakeFirestore({
    [globalPath]: { units: 9 },
    [clientPath]: { units: 1 },
  });

  const reservation = await __test.reserveUsage(
    buildConfig({ globalDailyUnitsLimit: 10, guestDailyUnitsLimit: 5 }),
    "chatAssistant",
    2,
    buildIdentity(),
    fakeDb
  );

  assert.equal(reservation.allowed, false);
  assert.equal(reservation.reason, "global_limit");
  assert.equal(fakeDb.transactionOps.length, 2);
  assert.ok(fakeDb.transactionOps.every((operation) => operation.type === "update"));
  assert.ok(
    fakeDb.transactionOps.every((operation) =>
      Object.hasOwn(operation.data, "actions.chatAssistant.quotaDenied")
    )
  );
});

test("Gemini action parsing and upstream errors map to callable error codes", () => {
  assert.deepEqual(
    __test.parseAction(
      { action: "recommendFactors", colleges: [{ id: "a" }, { id: "b" }, { id: "c" }] },
      buildConfig({ recommendBatchSize: 2 })
    ),
    { action: "recommendFactors", units: 2 }
  );

  assert.equal(__test.parseGeminiError(429, "RESOURCE_EXHAUSTED quota").code, "resource-exhausted");
  assert.equal(__test.parseGeminiError(408, "deadline exceeded").code, "deadline-exceeded");
  assert.equal(__test.parseGeminiError(503, "service down").code, "unavailable");
  assert.equal(__test.parseGeminiError(400, "bad request").code, "internal");
});
