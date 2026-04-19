const crypto = require("node:crypto");
const admin = require("firebase-admin");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { renderPromptTemplate } = require("./promptTemplates");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const { FieldValue } = admin.firestore;

const AI_USAGE_COLLECTION = "aiUsageDaily";
const GATEWAY_REGION = "us-central1";
const DEFAULT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_GEMINI_MODEL = "gemini-1.5-flash";
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_GLOBAL_DAILY_UNITS_LIMIT = 250;
const DEFAULT_AUTH_DAILY_UNITS_LIMIT = 60;
const DEFAULT_GUEST_DAILY_UNITS_LIMIT = 12;
const DEFAULT_RECOMMEND_BATCH_SIZE = 12;
const DEFAULT_MAX_CANDIDATES_PER_REQUEST = 20;
const MAX_CHAT_MESSAGE_CHARS = 4000;
const MAX_CHAT_CONTEXT_CHARS = 12000;
const MAX_TEXT_SIGNAL_CHARS = 500;
const MAX_STRING_FIELD_CHARS = 300;
const MAX_PROGRAMS_PER_COLLEGE = 10;
const MAX_ASSISTANT_COLLEGES = 6;
const MAX_ASSISTANT_REASON_CHARS = 220;
const MAX_ASSISTANT_SUMMARY_CHARS = 1200;
const MAX_ASSISTANT_EXPLANATION_CHARS = 500;
const MAX_DOCUMENT_BASE64_CHARS = 6500000;
const MAX_DOCUMENT_SOURCE_SNIPPET_CHARS = 240;
const MAX_DOCUMENT_LIST_ITEMS = 20;
const RECOMMEND_FACTOR_FALLBACK = 50;
const RECOMMEND_ACTION = "recommendFactors";
const CHAT_ASSISTANT_ACTION = "chatAssistant";
const DOCUMENT_EXTRACTION_ACTION = "documentExtraction";
const CHAT_ASSISTANT_TEXT_FORMAT = "text";
const CHAT_ASSISTANT_RECOMMENDATION_FORMAT = "recommendation_explanations_json";
const DOCUMENT_EXTRACTION_SUPPORTED_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/html",
  "application/xml",
  "text/xml",
  "image/png",
  "image/jpeg",
  "image/webp",
]);
const DEFAULT_ROADMAP_TASKS = [
  "Research colleges that offer your major",
  "Request transcripts from current institution",
  "Draft personal statement about transfer reasons",
  "Identify 2-3 professors for recommendation letters",
  "Create spreadsheet tracking application deadlines",
  "Review transfer credit policies at target schools",
];

function parseIntEnv(value, fallback, options = {}) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  const min = Number.isFinite(options.min) ? options.min : undefined;
  const max = Number.isFinite(options.max) ? options.max : undefined;
  if (typeof min === "number" && parsed < min) return min;
  if (typeof max === "number" && parsed > max) return max;
  return parsed;
}

function truncate(value, max) {
  return String(value ?? "").trim().slice(0, max);
}

function sanitizeScalar(value, max = MAX_STRING_FIELD_CHARS) {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return truncate(value, max);
  return truncate(value, max);
}

function sanitizeJson(value, depth = 0) {
  if (value == null) return null;
  if (depth > 3) return null;
  if (typeof value === "string") return truncate(value, MAX_STRING_FIELD_CHARS);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value
      .slice(0, 25)
      .map((item) => sanitizeJson(item, depth + 1))
      .filter((item) => item !== null && item !== "");
  }
  if (typeof value === "object") {
    const out = {};
    for (const [rawKey, rawVal] of Object.entries(value).slice(0, 40)) {
      const key = truncate(rawKey, 80);
      if (!key) continue;
      const sanitized = sanitizeJson(rawVal, depth + 1);
      if (sanitized === null || sanitized === "") continue;
      out[key] = sanitized;
    }
    return out;
  }
  return truncate(value, MAX_STRING_FIELD_CHARS);
}

function toNumberOrNull(value) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getConfig() {
  return {
    apiKey: String(process.env.GEMINI_API_KEY ?? "").trim(),
    baseUrl: String(process.env.GEMINI_BASE_URL ?? DEFAULT_GEMINI_BASE_URL).trim(),
    model: String(process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL).trim(),
    timeoutMs: parseIntEnv(process.env.GEMINI_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, { min: 4000, max: 30000 }),
    globalDailyUnitsLimit: parseIntEnv(
      process.env.GEMINI_GLOBAL_DAILY_UNITS_LIMIT,
      DEFAULT_GLOBAL_DAILY_UNITS_LIMIT,
      { min: 1, max: 5000 }
    ),
    authDailyUnitsLimit: parseIntEnv(
      process.env.GEMINI_AUTH_DAILY_UNITS_LIMIT,
      DEFAULT_AUTH_DAILY_UNITS_LIMIT,
      { min: 1, max: 1000 }
    ),
    guestDailyUnitsLimit: parseIntEnv(
      process.env.GEMINI_GUEST_DAILY_UNITS_LIMIT,
      DEFAULT_GUEST_DAILY_UNITS_LIMIT,
      { min: 1, max: 250 }
    ),
    recommendBatchSize: parseIntEnv(
      process.env.GEMINI_RECOMMEND_BATCH_SIZE,
      DEFAULT_RECOMMEND_BATCH_SIZE,
      { min: 1, max: 20 }
    ),
    maxCandidatesPerRequest: parseIntEnv(
      process.env.GEMINI_MAX_CANDIDATES_PER_REQUEST,
      DEFAULT_MAX_CANDIDATES_PER_REQUEST,
      { min: 1, max: 40 }
    ),
  };
}

function assertGatewayConfigured(config) {
  if (!config.apiKey) {
    throw new HttpsError(
      "failed-precondition",
      "Gemini gateway is not configured. Set GEMINI_API_KEY in the Functions environment."
    );
  }
}

function getDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function hashValue(input) {
  return crypto.createHash("sha256").update(String(input)).digest("hex");
}

function getRequestIdentity(request, data) {
  const authUid = typeof request.auth?.uid === "string" ? request.auth.uid : "";
  const rawClientInstanceId = truncate(data?.clientInstanceId, 128);
  const forwardedFor = String(request.rawRequest?.headers?.["x-forwarded-for"] ?? "")
    .split(",")[0]
    .trim();
  const ip = truncate(request.rawRequest?.ip ?? forwardedFor, 120);
  const userAgent = truncate(request.rawRequest?.headers?.["user-agent"] ?? "", 200);
  const scope = authUid ? "user" : "guest";
  const rawKey = authUid
    ? `uid:${authUid}`
    : `guest:${rawClientInstanceId || ip || userAgent || "unknown"}`;

  return {
    scope,
    authUid: authUid || null,
    clientKeyHash: hashValue(rawKey).slice(0, 40),
    clientInstanceId: rawClientInstanceId || null,
    ip: ip || null,
  };
}

function getQuotaLimits(config, scope) {
  return {
    globalLimit: config.globalDailyUnitsLimit,
    clientLimit: scope === "user" ? config.authDailyUnitsLimit : config.guestDailyUnitsLimit,
  };
}

function createActionStats({ requests = 0, units = 0, successes = 0, failures = 0, quotaDenied = 0, fallbacks = 0 } = {}) {
  return {
    requests,
    units,
    successes,
    failures,
    quotaDenied,
    fallbacks,
    totalTokens: 0,
    promptTokens: 0,
    candidateTokens: 0,
  };
}

function createGlobalUsageDoc(dateKey, action, units) {
  return {
    dateKey,
    requests: 1,
    units,
    successes: 0,
    failures: 0,
    quotaDenied: 0,
    fallbacks: 0,
    totalTokens: 0,
    promptTokens: 0,
    candidateTokens: 0,
    actions: {
      [action]: createActionStats({ requests: 1, units }),
    },
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    lastRequestAt: FieldValue.serverTimestamp(),
    lastAction: action,
  };
}

function createClientUsageDoc(dateKey, action, units, identity) {
  return {
    dateKey,
    clientScope: identity.scope,
    authUid: identity.authUid,
    clientInstanceId: identity.clientInstanceId,
    requests: 1,
    units,
    successes: 0,
    failures: 0,
    quotaDenied: 0,
    fallbacks: 0,
    totalTokens: 0,
    promptTokens: 0,
    candidateTokens: 0,
    actions: {
      [action]: createActionStats({ requests: 1, units }),
    },
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    lastRequestAt: FieldValue.serverTimestamp(),
    lastAction: action,
  };
}

function createBlockedGlobalUsageDoc(dateKey, action, reason) {
  return {
    dateKey,
    requests: 0,
    units: 0,
    successes: 0,
    failures: 0,
    quotaDenied: 1,
    fallbacks: 0,
    totalTokens: 0,
    promptTokens: 0,
    candidateTokens: 0,
    actions: {
      [action]: createActionStats({ quotaDenied: 1 }),
    },
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    lastDeniedAt: FieldValue.serverTimestamp(),
    lastAction: action,
    lastQuotaReason: reason,
  };
}

function createBlockedClientUsageDoc(dateKey, action, reason, identity) {
  return {
    dateKey,
    clientScope: identity.scope,
    authUid: identity.authUid,
    clientInstanceId: identity.clientInstanceId,
    requests: 0,
    units: 0,
    successes: 0,
    failures: 0,
    quotaDenied: 1,
    fallbacks: 0,
    totalTokens: 0,
    promptTokens: 0,
    candidateTokens: 0,
    actions: {
      [action]: createActionStats({ quotaDenied: 1 }),
    },
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    lastDeniedAt: FieldValue.serverTimestamp(),
    lastAction: action,
    lastQuotaReason: reason,
  };
}

function buildAttemptUsageUpdate(action, units) {
  return {
    requests: FieldValue.increment(1),
    units: FieldValue.increment(units),
    updatedAt: FieldValue.serverTimestamp(),
    lastRequestAt: FieldValue.serverTimestamp(),
    lastAction: action,
    [`actions.${action}.requests`]: FieldValue.increment(1),
    [`actions.${action}.units`]: FieldValue.increment(units),
  };
}

function buildBlockedUsageUpdate(action, reason) {
  return {
    quotaDenied: FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp(),
    lastDeniedAt: FieldValue.serverTimestamp(),
    lastAction: action,
    lastQuotaReason: reason,
    [`actions.${action}.quotaDenied`]: FieldValue.increment(1),
  };
}

function buildOutcomeUsageUpdate(action, outcome) {
  const updates = {
    updatedAt: FieldValue.serverTimestamp(),
    lastResponseAt: FieldValue.serverTimestamp(),
    lastAction: action,
    lastStatus: outcome.status,
    lastResponseMs: outcome.responseMs,
  };

  if (outcome.model) {
    updates.lastModel = outcome.model;
  }
  if (outcome.errorCode) {
    updates.lastErrorCode = outcome.errorCode;
  }
  if (outcome.errorMessage) {
    updates.lastErrorMessage = truncate(outcome.errorMessage, 500);
  }
  if (outcome.promptTemplate?.id) {
    updates.lastPromptTemplateId = outcome.promptTemplate.id;
  }
  if (outcome.promptTemplate?.version) {
    updates.lastPromptTemplateVersion = outcome.promptTemplate.version;
  }
  if (outcome.promptTemplate?.libraryVersion) {
    updates.lastPromptLibraryVersion = outcome.promptTemplate.libraryVersion;
  }

  const isSuccess = outcome.status === "success" || outcome.status === "partial_fallback";
  if (isSuccess) {
    updates.successes = FieldValue.increment(1);
    updates[`actions.${action}.successes`] = FieldValue.increment(1);
  } else {
    updates.failures = FieldValue.increment(1);
    updates[`actions.${action}.failures`] = FieldValue.increment(1);
  }

  if (outcome.status === "partial_fallback") {
    updates.fallbacks = FieldValue.increment(1);
    updates[`actions.${action}.fallbacks`] = FieldValue.increment(1);
  }

  const totalTokens = toNumberOrNull(outcome.usage?.totalTokens);
  const promptTokens = toNumberOrNull(outcome.usage?.promptTokens);
  const candidateTokens = toNumberOrNull(outcome.usage?.candidateTokens);

  if (totalTokens !== null && totalTokens > 0) {
    updates.totalTokens = FieldValue.increment(totalTokens);
    updates[`actions.${action}.totalTokens`] = FieldValue.increment(totalTokens);
  }
  if (promptTokens !== null && promptTokens > 0) {
    updates.promptTokens = FieldValue.increment(promptTokens);
    updates[`actions.${action}.promptTokens`] = FieldValue.increment(promptTokens);
  }
  if (candidateTokens !== null && candidateTokens > 0) {
    updates.candidateTokens = FieldValue.increment(candidateTokens);
    updates[`actions.${action}.candidateTokens`] = FieldValue.increment(candidateTokens);
  }

  return updates;
}

async function reserveUsage(config, action, units, identity) {
  const dateKey = getDateKey();
  const globalRef = db.collection(AI_USAGE_COLLECTION).doc(dateKey);
  const clientRef = globalRef.collection("clients").doc(identity.clientKeyHash);
  const { globalLimit, clientLimit } = getQuotaLimits(config, identity.scope);

  let reservation = null;

  await db.runTransaction(async (transaction) => {
    const [globalSnap, clientSnap] = await Promise.all([
      transaction.get(globalRef),
      transaction.get(clientRef),
    ]);

    const globalUsed = globalSnap.exists ? Number(globalSnap.get("units") ?? 0) : 0;
    const clientUsed = clientSnap.exists ? Number(clientSnap.get("units") ?? 0) : 0;
    const blockedReason =
      globalUsed + units > globalLimit
        ? "global_limit"
        : clientUsed + units > clientLimit
          ? "client_limit"
          : "";

    if (blockedReason) {
      if (globalSnap.exists) {
        transaction.update(globalRef, buildBlockedUsageUpdate(action, blockedReason));
      } else {
        transaction.set(globalRef, createBlockedGlobalUsageDoc(dateKey, action, blockedReason));
      }

      if (clientSnap.exists) {
        transaction.update(clientRef, buildBlockedUsageUpdate(action, blockedReason));
      } else {
        transaction.set(clientRef, createBlockedClientUsageDoc(dateKey, action, blockedReason, identity));
      }

      reservation = {
        allowed: false,
        reason: blockedReason,
        scope: identity.scope,
        globalLimit,
        clientLimit,
        globalUsed,
        clientUsed,
      };
      return;
    }

    if (globalSnap.exists) {
      transaction.update(globalRef, buildAttemptUsageUpdate(action, units));
    } else {
      transaction.set(globalRef, createGlobalUsageDoc(dateKey, action, units));
    }

    if (clientSnap.exists) {
      transaction.update(clientRef, buildAttemptUsageUpdate(action, units));
    } else {
      transaction.set(clientRef, createClientUsageDoc(dateKey, action, units, identity));
    }

    reservation = {
      allowed: true,
      action,
      units,
      dateKey,
      scope: identity.scope,
      authUid: identity.authUid,
      clientDocId: identity.clientKeyHash,
      globalLimit,
      clientLimit,
      globalRemaining: Math.max(0, globalLimit - (globalUsed + units)),
      clientRemaining: Math.max(0, clientLimit - (clientUsed + units)),
    };
  });

  return reservation;
}

async function finalizeUsage(reservation, outcome) {
  if (!reservation?.allowed) return;

  const globalRef = db.collection(AI_USAGE_COLLECTION).doc(reservation.dateKey);
  const clientRef = globalRef.collection("clients").doc(reservation.clientDocId);
  const updates = buildOutcomeUsageUpdate(reservation.action, outcome);

  await Promise.all([
    globalRef.update(updates),
    clientRef.update(updates),
  ]);
}

function extractGeminiText(json) {
  const parts = json?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part) => truncate(part?.text ?? "", 6000))
    .join("")
    .trim();
}

function parseUsageMetadata(json) {
  const usage = json?.usageMetadata ?? {};
  const promptTokens = toNumberOrNull(usage.promptTokenCount) ?? 0;
  const candidateTokens = toNumberOrNull(usage.candidatesTokenCount) ?? 0;
  const totalTokens = toNumberOrNull(usage.totalTokenCount) ?? 0;
  return {
    promptTokens,
    candidateTokens,
    totalTokens,
  };
}

function parseGeminiError(status, rawText) {
  const message = truncate(rawText, 800) || `Gemini request failed with status ${status}`;
  const normalized = message.toLowerCase();

  if (status === 429 || normalized.includes("resource_exhausted") || normalized.includes("quota")) {
    return new HttpsError("resource-exhausted", "Gemini quota or rate limit reached.", {
      upstreamStatus: status,
      upstreamMessage: message,
    });
  }
  if (status === 408 || normalized.includes("deadline")) {
    return new HttpsError("deadline-exceeded", "Gemini request timed out.", {
      upstreamStatus: status,
      upstreamMessage: message,
    });
  }
  if (status >= 500) {
    return new HttpsError("unavailable", "Gemini upstream service is unavailable.", {
      upstreamStatus: status,
      upstreamMessage: message,
    });
  }
  return new HttpsError("internal", "Gemini request failed.", {
    upstreamStatus: status,
    upstreamMessage: message,
  });
}

async function callGemini(config, prompt, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const promptPart = prompt ? { text: prompt } : null;
    const parts = Array.isArray(options.parts) && options.parts.length
      ? options.parts
      : promptPart
        ? [promptPart]
        : [];

    const response = await fetch(
      `${config.baseUrl}/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts,
            },
          ],
          generationConfig: {
            maxOutputTokens: options.maxOutputTokens ?? 512,
            temperature: options.temperature ?? 0.2,
            ...(options.responseMimeType ? { responseMimeType: options.responseMimeType } : {}),
          },
        }),
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      const rawText = await response.text().catch(() => "");
      throw parseGeminiError(response.status, rawText);
    }

    const json = await response.json();
    return {
      text: extractGeminiText(json),
      usage: parseUsageMetadata(json),
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new HttpsError("deadline-exceeded", "Gemini request timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildChatPrompt(data) {
  const message = truncate(data?.message, MAX_CHAT_MESSAGE_CHARS);
  const context = truncate(data?.context, MAX_CHAT_CONTEXT_CHARS);
  if (!message) {
    throw new HttpsError("invalid-argument", "Chat message is required.");
  }
  return renderPromptTemplate("chatAssistant", {
    message,
    context,
  });
}

function sanitizeDocumentExtractionField(rawField, options = {}) {
  if (!rawField || typeof rawField !== "object" || Array.isArray(rawField)) return null;
  const value = rawField.value;
  let normalizedValue = null;

  if (Array.isArray(value)) {
    normalizedValue = value
      .slice(0, MAX_DOCUMENT_LIST_ITEMS)
      .map((item) => truncate(item, 120))
      .filter(Boolean);
  } else if (typeof value === "string" || typeof value === "number") {
    normalizedValue = truncate(value, options.maxValueChars ?? MAX_STRING_FIELD_CHARS);
  }

  if (
    normalizedValue === null ||
    normalizedValue === "" ||
    (Array.isArray(normalizedValue) && !normalizedValue.length)
  ) {
    return null;
  }

  return {
    value: normalizedValue,
    sourceSnippet: truncate(rawField.sourceSnippet, MAX_DOCUMENT_SOURCE_SNIPPET_CHARS) || null,
    confidence: Math.max(0, Math.min(100, Math.round(toNumberOrNull(rawField.confidence) ?? 0))),
  };
}

function sanitizeDocumentExtractionResponse(raw, fallbackDocumentType) {
  const extractedFields = raw?.extractedFields && typeof raw.extractedFields === "object" && !Array.isArray(raw.extractedFields)
    ? raw.extractedFields
    : {};

  return {
    documentType: truncate(raw?.documentType, 40) || fallbackDocumentType || "unknown",
    extractedFields: {
      ...(sanitizeDocumentExtractionField(extractedFields.gpa, { maxValueChars: 40 }) ? { gpa: sanitizeDocumentExtractionField(extractedFields.gpa, { maxValueChars: 40 }) } : {}),
      ...(sanitizeDocumentExtractionField(extractedFields.major, { maxValueChars: 160 }) ? { major: sanitizeDocumentExtractionField(extractedFields.major, { maxValueChars: 160 }) } : {}),
      ...(sanitizeDocumentExtractionField(extractedFields.majorSignals, { maxValueChars: 160 }) ? { majorSignals: sanitizeDocumentExtractionField(extractedFields.majorSignals, { maxValueChars: 160 }) } : {}),
      ...(sanitizeDocumentExtractionField(extractedFields.completedCourses, { maxValueChars: 200 }) ? { completedCourses: sanitizeDocumentExtractionField(extractedFields.completedCourses, { maxValueChars: 200 }) } : {}),
      ...(sanitizeDocumentExtractionField(extractedFields.transferCredits, { maxValueChars: 120 }) ? { transferCredits: sanitizeDocumentExtractionField(extractedFields.transferCredits, { maxValueChars: 120 }) } : {}),
      ...(sanitizeDocumentExtractionField(extractedFields.resumeSkills, { maxValueChars: 160 }) ? { resumeSkills: sanitizeDocumentExtractionField(extractedFields.resumeSkills, { maxValueChars: 160 }) } : {}),
    },
    uncertainties: Array.isArray(raw?.uncertainties)
      ? raw.uncertainties.map((item) => truncate(item, 220)).filter(Boolean).slice(0, 8)
      : [],
    confidence: Math.max(0, Math.min(100, Math.round(toNumberOrNull(raw?.confidence) ?? 0))),
  };
}

function sanitizeDocumentExtractionInput(data) {
  const documentType = truncate(data?.documentType, 40).toLowerCase();
  if (documentType !== "resume" && documentType !== "transcript") {
    throw new HttpsError("invalid-argument", "documentType must be resume or transcript.");
  }

  const mimeType = truncate(data?.mimeType, 120).toLowerCase();
  if (!DOCUMENT_EXTRACTION_SUPPORTED_MIME_TYPES.has(mimeType)) {
    throw new HttpsError("invalid-argument", "Unsupported document type for extraction.");
  }

  const fileBase64 = String(data?.fileBase64 ?? "").trim();
  if (!fileBase64) {
    throw new HttpsError("invalid-argument", "Document bytes are required for extraction.");
  }
  if (fileBase64.length > MAX_DOCUMENT_BASE64_CHARS) {
    throw new HttpsError("invalid-argument", "Document is too large for inline extraction.");
  }

  return {
    documentType,
    mimeType,
    fileBase64,
    documentMeta: sanitizeJson(data?.documentMeta ?? {}),
    currentProfile: sanitizeJson(data?.currentProfile ?? {}),
    questionnaire: sanitizeJson(data?.questionnaire ?? {}),
  };
}

function buildDocumentExtractionPrompt(input) {
  return renderPromptTemplate("documentExtraction", {
    documentMeta: {
      documentType: input.documentType,
      mimeType: input.mimeType,
      ...(input.documentMeta ?? {}),
    },
    currentProfile: input.currentProfile ?? {},
    questionnaire: input.questionnaire ?? {},
    documentText: "[Binary document supplied inline to Gemini.]",
  });
}

function sanitizeAssistantCollege(college) {
  const id = truncate(college?.id, 64);
  if (!id) return null;

  return {
    id,
    name: truncate(college?.name, 160),
    location: {
      city: truncate(college?.location?.city, 120) || null,
      state: truncate(college?.location?.state ?? college?.state, 80) || null,
    },
    matchScore: toNumberOrNull(college?.matchScore),
    score: toNumberOrNull(college?.score),
    scoreText: truncate(college?.scoreText, 80) || null,
    reason: truncate(college?.reason, MAX_ASSISTANT_REASON_CHARS) || null,
    tuition: toNumberOrNull(college?.tuition),
    tuitionInState: toNumberOrNull(college?.tuitionInState),
    tuitionOutOfState: toNumberOrNull(college?.tuitionOutOfState),
    avgNetPriceOverall: toNumberOrNull(college?.avgNetPriceOverall),
    admissionRate: toNumberOrNull(college?.admissionRate),
    completionRate: toNumberOrNull(college?.completionRate),
    pellGrantRate: toNumberOrNull(college?.pellGrantRate),
    medianDebtCompletersOverall: toNumberOrNull(college?.medianDebtCompletersOverall),
    size: sanitizeScalar(college?.size, 40),
    setting: sanitizeScalar(college?.setting, 40),
    locale: sanitizeScalar(college?.locale, 80),
    programs: Array.isArray(college?.programs)
      ? college.programs.map((program) => truncate(program, 120)).filter(Boolean).slice(0, MAX_PROGRAMS_PER_COLLEGE)
      : [],
  };
}

function sanitizeChatAssistantInput(data) {
  const query = truncate(data?.query ?? data?.message, MAX_CHAT_MESSAGE_CHARS);
  if (!query) {
    throw new HttpsError("invalid-argument", "Assistant query is required.");
  }

  const rawOutputFormat = truncate(data?.outputFormat, 80).toLowerCase();
  const outputFormat = rawOutputFormat === CHAT_ASSISTANT_RECOMMENDATION_FORMAT
    ? CHAT_ASSISTANT_RECOMMENDATION_FORMAT
    : CHAT_ASSISTANT_TEXT_FORMAT;

  const context = typeof data?.context === "string"
    ? truncate(data.context, MAX_CHAT_CONTEXT_CHARS)
    : sanitizeJson(data?.context ?? {});

  const explicitTopRankedColleges = Array.isArray(data?.topRankedColleges)
    ? data.topRankedColleges.map(sanitizeAssistantCollege).filter(Boolean)
    : [];

  const contextTopMatches = !explicitTopRankedColleges.length && !Array.isArray(context)
    ? Array.isArray(context?.topMatches)
      ? context.topMatches.map(sanitizeAssistantCollege).filter(Boolean)
      : []
    : [];

  return {
    query,
    outputFormat,
    context,
    topRankedColleges: [...explicitTopRankedColleges, ...contextTopMatches].slice(0, MAX_ASSISTANT_COLLEGES),
  };
}

function stringifyAssistantContext(context) {
  if (!context) return "";
  if (typeof context === "string") return context;
  return JSON.stringify(context);
}

function buildChatAssistantPrompt(data) {
  const input = sanitizeChatAssistantInput(data);
  return {
    input,
    promptTemplate: renderPromptTemplate("chatAssistant", {
      message: input.query,
      context: stringifyAssistantContext(input.context),
      rankedColleges: input.topRankedColleges,
      outputFormat: input.outputFormat,
    }),
  };
}

function buildRecommendationExplanationPrompt(input) {
  const structuredContext = typeof input.context === "object" && !Array.isArray(input.context)
    ? input.context
    : {};

  return renderPromptTemplate("recommendationExplanation", {
    userProfile: structuredContext.profile ?? {},
    questionnaire: structuredContext.questionnaire ?? {},
    context: structuredContext,
    userRequest: input.query,
    colleges: input.topRankedColleges,
  });
}

function buildChatAssistantTextFallback(input) {
  const topColleges = input.topRankedColleges ?? [];
  if (!topColleges.length) {
    return "I can help with transfer planning, college comparisons, costs, deadlines, and next steps. Ask about a school, a transfer requirement, or what to do next.";
  }

  const summary = topColleges
    .slice(0, 3)
    .map((college) => {
      const reason = truncate(college.reason, 120);
      return reason ? `${college.name} (${reason})` : college.name;
    })
    .join("; ");

  return `Based on your current profile and saved data, strong colleges to review next are ${summary}. Verify deadlines, transfer policies, and costs on each college's official website before making decisions.`;
}

function buildRecommendationExplanationFallback(input) {
  const colleges = input.topRankedColleges ?? [];
  const collegeExplanations = colleges.slice(0, MAX_ASSISTANT_COLLEGES).map((college) => {
    const fitSignals = [
      college.reason,
      college.matchScore !== null ? `match score ${Math.round(college.matchScore)}/100` : "",
      college.avgNetPriceOverall !== null ? `average net price ${college.avgNetPriceOverall}` : "",
      college.completionRate !== null ? `completion rate ${college.completionRate}` : "",
    ].filter(Boolean);

    return {
      id: college.id || null,
      name: college.name || "Recommended college",
      explanation: truncate(
        fitSignals.length
          ? `${college.name} stands out because of ${fitSignals.join(", ")}.`
          : `${college.name} appears to fit your current profile and saved preferences.`,
        MAX_ASSISTANT_EXPLANATION_CHARS
      ),
    };
  });

  const summary = truncate(
    collegeExplanations.length
      ? `These colleges fit best based on your current profile, questionnaire answers, and ranked school data.`
      : buildChatAssistantTextFallback(input),
    MAX_ASSISTANT_SUMMARY_CHARS
  );

  return {
    summary,
    collegeExplanations,
  };
}

function coerceRecommendationExplanation(text, input) {
  const parsed = JSON.parse(text || "{}");
  const fallback = buildRecommendationExplanationFallback(input);
  const summary = truncate(parsed?.summary, MAX_ASSISTANT_SUMMARY_CHARS) || fallback.summary;
  const rawItems = Array.isArray(parsed?.collegeExplanations) ? parsed.collegeExplanations : [];
  const collegeExplanations = rawItems
    .map((item, index) => {
      const fallbackItem = fallback.collegeExplanations[index];
      const explanation = truncate(item?.explanation, MAX_ASSISTANT_EXPLANATION_CHARS);
      const name = truncate(item?.name, 160) || fallbackItem?.name || null;
      if (!explanation || !name) return null;
      return {
        id: truncate(item?.id, 64) || fallbackItem?.id || null,
        name,
        explanation,
      };
    })
    .filter(Boolean);

  return {
    summary,
    collegeExplanations: collegeExplanations.length ? collegeExplanations : fallback.collegeExplanations,
  };
}

function buildRoadmapPrompt(data) {
  const userProfile = sanitizeJson(data?.userProfile ?? {});
  return renderPromptTemplate("roadmapTasks", {
    userProfile,
  });
}

function sanitizeCandidateCollege(college) {
  const id = truncate(college?.id, 64);
  if (!id) return null;

  return {
    id,
    name: truncate(college?.name, 160),
    state: truncate(college?.state ?? college?.location?.state, 80),
    tuition: toNumberOrNull(college?.tuition),
    setting: sanitizeScalar(college?.setting, 40),
    size: sanitizeScalar(college?.size, 40),
    admissionRate: toNumberOrNull(college?.admissionRate),
    completionRate: toNumberOrNull(college?.completionRate),
    programs: Array.isArray(college?.programs)
      ? college.programs.map((program) => truncate(program, 120)).filter(Boolean).slice(0, MAX_PROGRAMS_PER_COLLEGE)
      : [],
  };
}

function sanitizeRecommendInput(data, config) {
  const colleges = Array.isArray(data?.colleges) ? data.colleges.map(sanitizeCandidateCollege).filter(Boolean) : [];
  if (!colleges.length) {
    throw new HttpsError("invalid-argument", "At least one college candidate is required for AI factor scoring.");
  }
  if (colleges.length > config.maxCandidatesPerRequest) {
    throw new HttpsError(
      "invalid-argument",
      `Too many college candidates. Maximum is ${config.maxCandidatesPerRequest}.`
    );
  }

  return {
    colleges,
    userProfile: sanitizeJson(data?.userProfile ?? {}),
    questionnaire: sanitizeJson(data?.questionnaire ?? {}),
    query: truncate(data?.query, 240),
  };
}

function buildRecommendPrompt(input, subset) {
  const questionnaire = input.questionnaire ?? {};
  const textSignals = truncate(
    `${questionnaire.companiesNearby ?? ""}\n${questionnaire.extracurriculars ?? ""}`,
    MAX_TEXT_SIGNAL_CHARS
  );

  return renderPromptTemplate("recommendFactorScoring", {
    userProfile: input.userProfile ?? {},
    questionnaire,
    query: input.query ?? "",
    textSignals,
    colleges: subset,
  });
}

function coerceRoadmapTasks(text) {
  const lines = String(text ?? "")
    .split("\n")
    .map((line) => line.replace(/^[-*\d.\s]+/, "").trim())
    .filter(Boolean);

  return lines.length ? lines.slice(0, 6) : DEFAULT_ROADMAP_TASKS;
}

function mergeUsage(target, next) {
  if (!next) return target;
  return {
    promptTokens: (target.promptTokens ?? 0) + (toNumberOrNull(next.promptTokens) ?? 0),
    candidateTokens: (target.candidateTokens ?? 0) + (toNumberOrNull(next.candidateTokens) ?? 0),
    totalTokens: (target.totalTokens ?? 0) + (toNumberOrNull(next.totalTokens) ?? 0),
  };
}

async function handleChat(config, data) {
  const promptTemplate = buildChatPrompt(data);
  const gemini = await callGemini(config, promptTemplate.prompt, {
    maxOutputTokens: 512,
    temperature: 0.5,
  });
  return {
    text: gemini.text || "I'm here to help with your college journey. What would you like to know?",
    usage: gemini.usage,
    promptTemplate,
  };
}

async function handleChatAssistant(config, data) {
  const { input, promptTemplate } = buildChatAssistantPrompt(data);

  if (input.outputFormat === CHAT_ASSISTANT_RECOMMENDATION_FORMAT) {
    const explanationPromptTemplate = buildRecommendationExplanationPrompt(input);
    const gemini = await callGemini(config, explanationPromptTemplate.prompt, {
      maxOutputTokens: 768,
      temperature: 0.2,
      responseMimeType: "application/json",
    });

    let explanation = null;
    let usedFallback = false;
    try {
      explanation = coerceRecommendationExplanation(gemini.text, input);
    } catch {
      explanation = buildRecommendationExplanationFallback(input);
      usedFallback = true;
    }

    return {
      text: explanation.summary || buildChatAssistantTextFallback(input),
      explanation,
      usage: gemini.usage,
      usedFallback,
      promptTemplate: explanationPromptTemplate,
      outputFormat: input.outputFormat,
    };
  }

  const gemini = await callGemini(config, promptTemplate.prompt, {
    maxOutputTokens: 512,
    temperature: 0.4,
  });

  return {
    text: gemini.text || buildChatAssistantTextFallback(input),
    usage: gemini.usage,
    promptTemplate,
    outputFormat: input.outputFormat,
  };
}

async function handleDocumentExtraction(config, data) {
  const input = sanitizeDocumentExtractionInput(data);
  const promptTemplate = buildDocumentExtractionPrompt(input);
  const gemini = await callGemini(config, promptTemplate.prompt, {
    maxOutputTokens: 768,
    temperature: 0.1,
    responseMimeType: "application/json",
    parts: [
      { text: promptTemplate.prompt },
      {
        inline_data: {
          mime_type: input.mimeType,
          data: input.fileBase64,
        },
      },
    ],
  });

  let extraction = null;
  let usedFallback = false;
  try {
    extraction = sanitizeDocumentExtractionResponse(JSON.parse(gemini.text || "{}"), input.documentType);
  } catch {
    extraction = {
      documentType: input.documentType,
      extractedFields: {},
      uncertainties: ["The document was processed, but the structured extraction could not be parsed reliably."],
      confidence: 0,
    };
    usedFallback = true;
  }

  return {
    extraction,
    usage: gemini.usage,
    usedFallback,
    promptTemplate,
  };
}

async function handleRoadmap(config, data) {
  const promptTemplate = buildRoadmapPrompt(data);
  const gemini = await callGemini(config, promptTemplate.prompt, {
    maxOutputTokens: 256,
    temperature: 0.3,
  });

  return {
    tasks: coerceRoadmapTasks(gemini.text),
    usage: gemini.usage,
    promptTemplate,
  };
}

async function handleRecommendFactors(config, data) {
  const input = sanitizeRecommendInput(data, config);
  const output = Object.fromEntries(input.colleges.map((college) => [String(college.id), RECOMMEND_FACTOR_FALLBACK]));
  const batchSize = Math.max(1, config.recommendBatchSize);
  let usage = { promptTokens: 0, candidateTokens: 0, totalTokens: 0 };
  let usedFallback = false;

  for (let i = 0; i < input.colleges.length; i += batchSize) {
    const subset = input.colleges.slice(i, i + batchSize);
    const promptTemplate = buildRecommendPrompt(input, subset);

    try {
      const gemini = await callGemini(config, promptTemplate.prompt, {
        maxOutputTokens: 512,
        temperature: 0.1,
        responseMimeType: "application/json",
      });
      usage = mergeUsage(usage, gemini.usage);

      const parsed = JSON.parse(gemini.text || "[]");
      if (!Array.isArray(parsed)) {
        throw new Error("Gemini recommend factors response was not an array.");
      }

      for (const item of parsed) {
        const id = truncate(item?.id, 64);
        if (!id || !(id in output)) continue;
        const raw = toNumberOrNull(item?.aiFactor);
        output[id] = raw === null ? RECOMMEND_FACTOR_FALLBACK : Math.max(0, Math.min(100, Math.round(raw)));
      }
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      usedFallback = true;
    }
  }

  return {
    factors: input.colleges.map((college) => ({
      id: String(college.id),
      aiFactor: output[String(college.id)] ?? RECOMMEND_FACTOR_FALLBACK,
    })),
    usage,
    usedFallback,
    promptTemplate: renderPromptTemplate("recommendFactorScoring", {
      userProfile: input.userProfile ?? {},
      questionnaire: input.questionnaire ?? {},
      query: input.query ?? "",
      textSignals: truncate(
        `${input.questionnaire?.companiesNearby ?? ""}\n${input.questionnaire?.extracurriculars ?? ""}`,
        MAX_TEXT_SIGNAL_CHARS
      ),
      colleges: input.colleges.slice(0, Math.min(batchSize, input.colleges.length)),
    }),
  };
}

function parseAction(data, config) {
  const action = truncate(data?.action, 40);

  if (action === "chat") {
    return { action, units: 1 };
  }
  if (action === CHAT_ASSISTANT_ACTION) {
    return { action, units: 1 };
  }
  if (action === DOCUMENT_EXTRACTION_ACTION) {
    return { action, units: 1 };
  }
  if (action === "roadmap") {
    return { action, units: 1 };
  }
  if (action === RECOMMEND_ACTION) {
    const candidateCount = Array.isArray(data?.colleges) ? data.colleges.length : 0;
    if (!candidateCount) {
      throw new HttpsError("invalid-argument", "AI factor scoring requires college candidates.");
    }
    return {
      action,
      units: Math.max(1, Math.ceil(candidateCount / Math.max(1, config.recommendBatchSize))),
    };
  }

  throw new HttpsError("invalid-argument", "Unsupported AI gateway action.");
}

exports.geminiGateway = onCall(
  {
    region: GATEWAY_REGION,
    timeoutSeconds: 30,
    maxInstances: 3,
  },
  async (request) => {
    const config = getConfig();
    assertGatewayConfigured(config);

    const identity = getRequestIdentity(request, request.data ?? {});
    const requestId = crypto.randomUUID();
    const parsed = parseAction(request.data ?? {}, config);
    const reservation = await reserveUsage(config, parsed.action, parsed.units, identity);

    if (!reservation?.allowed) {
      throw new HttpsError("resource-exhausted", "Daily Gemini quota reached for this account or device.", {
        requestId,
        reason: reservation?.reason ?? "quota",
        clientLimit: reservation?.clientLimit ?? 0,
        globalLimit: reservation?.globalLimit ?? 0,
      });
    }

    const startedAt = Date.now();
    let payload = null;

    try {
      if (parsed.action === "chat") {
        payload = await handleChat(config, request.data ?? {});
      } else if (parsed.action === CHAT_ASSISTANT_ACTION) {
        payload = await handleChatAssistant(config, request.data ?? {});
      } else if (parsed.action === DOCUMENT_EXTRACTION_ACTION) {
        payload = await handleDocumentExtraction(config, request.data ?? {});
      } else if (parsed.action === "roadmap") {
        payload = await handleRoadmap(config, request.data ?? {});
      } else {
        payload = await handleRecommendFactors(config, request.data ?? {});
      }

      const responseMs = Date.now() - startedAt;
      await finalizeUsage(reservation, {
        status: payload.usedFallback ? "partial_fallback" : "success",
        usage: payload.usage,
        responseMs,
        model: config.model,
        promptTemplate: payload.promptTemplate,
      });

      return {
        ok: true,
        requestId,
        model: config.model,
        quota: {
          scope: identity.scope,
          unitsConsumed: parsed.units,
          clientLimit: reservation.clientLimit,
          clientRemaining: reservation.clientRemaining,
          globalLimit: reservation.globalLimit,
          globalRemaining: reservation.globalRemaining,
          dateKey: reservation.dateKey,
        },
        usage: payload.usage,
        ...(payload.promptTemplate
          ? {
              promptTemplate: {
                id: payload.promptTemplate.id,
                version: payload.promptTemplate.version,
                libraryVersion: payload.promptTemplate.libraryVersion,
              },
            }
          : {}),
        ...(payload.text ? { text: payload.text } : {}),
        ...(payload.outputFormat ? { outputFormat: payload.outputFormat } : {}),
        ...(payload.explanation ? { explanation: payload.explanation } : {}),
        ...(payload.extraction ? { extraction: payload.extraction } : {}),
        ...(payload.tasks ? { tasks: payload.tasks } : {}),
        ...(payload.factors ? { factors: payload.factors } : {}),
        ...(payload.usedFallback ? { usedFallback: true } : {}),
      };
    } catch (error) {
      const responseMs = Date.now() - startedAt;
      await finalizeUsage(reservation, {
        status: "failure",
        usage: null,
        responseMs,
        model: config.model,
        promptTemplate: payload?.promptTemplate,
        errorCode: error?.code ? String(error.code) : "unknown",
        errorMessage: error?.message ? String(error.message) : "Unknown AI gateway error",
      }).catch(() => {});

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError("internal", "AI gateway request failed.", {
        requestId,
        message: truncate(error?.message ?? "Unknown error", 500),
      });
    }
  }
);
