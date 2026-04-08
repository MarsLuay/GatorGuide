const crypto = require("node:crypto");
const admin = require("firebase-admin");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { renderPromptTemplate } = require("./promptTemplates");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const { Timestamp } = admin.firestore;

const GATEWAY_REGION = "us-central1";
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_GEMINI_MODEL = "gemini-1.5-flash";
const SCORECARD_BASE_URL = "https://api.data.gov/ed/collegescorecard/v1/schools";
const MAX_EVIDENCE_CHARS = 9000;
const GREEN_RIVER_FOUNDATION_SCHOLARSHIP_ID =
  "green-river-foundation-scholarship";

function getConfig() {
  return {
    geminiApiKey: String(process.env.GEMINI_API_KEY ?? "").trim(),
    geminiBaseUrl: String(
      process.env.GEMINI_BASE_URL ?? DEFAULT_GEMINI_BASE_URL
    ).trim(),
    geminiModel: String(process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL).trim(),
    scorecardApiKey: String(
      process.env.COLLEGE_SCORECARD_API_KEY ??
        process.env.EXPO_PUBLIC_COLLEGE_SCORECARD_KEY ??
        ""
    ).trim(),
    timeoutMs: Number.parseInt(
      String(process.env.OPPORTUNITY_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS),
      10
    ) || DEFAULT_TIMEOUT_MS,
  };
}

function assertAuthenticated(request) {
  if (!request.auth?.uid) {
    throw new HttpsError(
      "unauthenticated",
      "Authentication is required for opportunity writes."
    );
  }
}

function parseConfigList(value, options = {}) {
  const normalizeCase = options.normalizeCase ?? "none";
  return String(value ?? "")
    .split(",")
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .map((item) => {
      if (normalizeCase === "lower") return item.toLowerCase();
      if (normalizeCase === "upper") return item.toUpperCase();
      return item;
    });
}

function getOpportunityAdminDecision(request) {
  const allowedEmails = parseConfigList(process.env.OPPORTUNITY_ADMIN_EMAILS, {
    normalizeCase: "lower",
  });
  const allowedUids = parseConfigList(process.env.OPPORTUNITY_ADMIN_UIDS);
  const uid = truncate(request.auth?.uid, 128);
  const email = truncate(request.auth?.token?.email, 320).toLowerCase() || null;
  const authorizedBy = allowedUids.includes(uid)
    ? "uid"
    : email && allowedEmails.includes(email)
      ? "email"
      : null;

  return {
    authorized: !!authorizedBy,
    authorizedBy,
    email,
    allowedEmailsConfigured: allowedEmails.length > 0,
    allowedUidsConfigured: allowedUids.length > 0,
  };
}

function assertOpportunityAdmin(request) {
  const decision = getOpportunityAdminDecision(request);
  if (decision.authorized) return decision;
  throw new HttpsError(
    "permission-denied",
    "This account is not allowed to edit opportunity content."
  );
}

function truncate(value, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function slugify(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function parseJson(text, fallback = {}) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function decodeHtmlEntities(value) {
  const entityMap = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    "#39": "'",
  };

  return String(value ?? "").replace(
    /&(amp|lt|gt|quot|#39);/g,
    (match, entity) => entityMap[entity] ?? match
  );
}

function stripHtmlToText(html) {
  return decodeHtmlEntities(
    String(html ?? "")
      .replace(/<script\b[^>]*>[\s\S]*?<\/script\b[^>]*>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style\b[^>]*>/gi, " ")
      .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript\b[^>]*>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function buildIsoDueDate(dateOnly, timezone) {
  if (!dateOnly) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return null;
  const suffix = timezone === "UTC" ? "T09:00:00.000Z" : "T09:00:00.000-07:00";
  return `${dateOnly}${suffix}`;
}

function getMonthDayFromIso(dateOnly) {
  const match = String(dateOnly ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return { month: null, day: null };
  return {
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function normalizeUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  try {
    return new URL(raw).toString();
  } catch {
    try {
      return new URL(`https://${raw}`).toString();
    } catch {
      return null;
    }
  }
}

function normalizeDeadlineType(value) {
  const parsed = String(value ?? "").trim().toLowerCase();
  if (parsed === "priority") return "priority";
  if (parsed === "rolling") return "rolling";
  return "final";
}

function normalizeOpportunityType(value) {
  const parsed = String(value ?? "").trim().toLowerCase();
  if (parsed === "internship") return "internship";
  if (parsed === "general_deadline") return "general_deadline";
  if (parsed === "college_deadline") return "college_deadline";
  return "scholarship";
}

function normalizeOpportunityStatus(value) {
  const parsed = String(value ?? "").trim().toLowerCase();
  if (parsed === "draft") return "draft";
  if (parsed === "archived") return "archived";
  return "active";
}

function parseBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  const parsed = String(value ?? "").trim().toLowerCase();
  if (!parsed) return fallback;
  if (["1", "true", "yes", "on"].includes(parsed)) return true;
  if (["0", "false", "no", "off"].includes(parsed)) return false;
  return fallback;
}

function parseNullableInteger(value, min = 0, max = 9999) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(max, Math.max(min, parsed));
}

function parseNullableNumber(value, min = 0, max = 999999999) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeCurrency(value) {
  const parsed = String(value ?? "").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(parsed) ? parsed : "USD";
}

function normalizeTagList(values, options = {}) {
  const lowercase = options.lowercase ?? true;
  const rawList = Array.isArray(values)
    ? values
    : String(values ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

  return Array.from(
    new Set(
      rawList
        .map((value) => truncate(value, 120))
        .map((value) => (lowercase ? value.toLowerCase() : value))
        .filter(Boolean)
    )
  );
}

function normalizeDateOnly(value) {
  const parsed = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(parsed) ? parsed : null;
}

function getHost(value) {
  try {
    return new URL(String(value ?? "")).host.toLowerCase();
  } catch {
    return "";
  }
}

async function fetchWithTimeout(url, config, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "user-agent": "GatorGuideOpportunityGateway/1.0",
        ...(options.headers ?? {}),
      },
    });
    return response;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new HttpsError("deadline-exceeded", "Opportunity request timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callGemini(config, prompt) {
  if (!config.geminiApiKey) {
    throw new HttpsError(
      "failed-precondition",
      "Gemini is not configured for opportunity deadline lookup."
    );
  }

  const response = await fetchWithTimeout(
    `${config.geminiBaseUrl}/models/${encodeURIComponent(
      config.geminiModel
    )}:generateContent?key=${encodeURIComponent(config.geminiApiKey)}`,
    config,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          maxOutputTokens: 512,
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new HttpsError(
      "unavailable",
      `Gemini deadline lookup failed: ${truncate(text, 300)}`
    );
  }

  const json = await response.json();
  const parts = json?.candidates?.[0]?.content?.parts ?? [];
  return parts.map((part) => String(part?.text ?? "")).join("").trim();
}

function extractSearchResultUrls(html, officialHost) {
  const matches = Array.from(
    String(html ?? "").matchAll(/href="([^"]+)"/gi)
  ).map((match) => decodeHtmlEntities(match[1]));

  const directUrls = matches
    .map((href) => {
      if (href.startsWith("/l/?")) {
        try {
          const parsed = new URL(`https://html.duckduckgo.com${href}`);
          return parsed.searchParams.get("uddg");
        } catch {
          return null;
        }
      }
      return href;
    })
    .map(normalizeUrl)
    .filter(Boolean)
    .filter((url) => {
      if (!officialHost) return true;
      const host = getHost(url);
      return host === officialHost || host.endsWith(`.${officialHost}`);
    });

  return Array.from(new Set(directUrls)).slice(0, 4);
}

async function searchOfficialPages(college, config) {
  const officialUrl = normalizeUrl(college.website);
  const officialHost = getHost(officialUrl);
  const searchTerms = [
    `${college.name} transfer deadline site:${officialHost || ".edu"}`,
    `${college.name} application deadline site:${officialHost || ".edu"}`,
  ];

  const urls = [];
  for (const term of searchTerms) {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(
      term
    )}`;
    const response = await fetchWithTimeout(searchUrl, config);
    if (!response.ok) continue;
    const html = await response.text();
    urls.push(...extractSearchResultUrls(html, officialHost));
  }

  return Array.from(new Set(urls)).slice(0, 4);
}

async function fetchEvidence(urls, config) {
  const evidence = [];
  for (const url of urls) {
    try {
      const response = await fetchWithTimeout(url, config);
      if (!response.ok) continue;
      const html = await response.text();
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      evidence.push({
        url,
        title: truncate(stripHtmlToText(titleMatch?.[1] ?? ""), 180),
        text: truncate(stripHtmlToText(html), MAX_EVIDENCE_CHARS),
      });
    } catch {
      // best effort
    }
  }
  return evidence;
}

async function lookupDeadline(config, college) {
  const urls = await searchOfficialPages(college, config);
  const evidence = await fetchEvidence(urls, config);
  if (!evidence.length) {
    throw new HttpsError(
      "not-found",
      "No official college deadline evidence could be found."
    );
  }

  const promptTemplate = renderPromptTemplate("deadlineLookup", {
    currentDate: new Date().toISOString().slice(0, 10),
    college,
    evidence,
  });
  const text = await callGemini(config, promptTemplate.prompt);
  const parsed = parseJson(text, {});
  const sourceUrl =
    normalizeUrl(parsed?.sourceUrl) ?? normalizeUrl(evidence[0]?.url) ?? null;
  const dueDate = truncate(parsed?.dueDate, 20);
  const timezone = truncate(parsed?.timezone, 80) || "America/Los_Angeles";
  const deadlineType = normalizeDeadlineType(parsed?.deadlineType);
  const deadlineLabel = truncate(parsed?.deadlineLabel, 160) || null;
  const confidence = truncate(parsed?.confidence, 80) || null;
  const notes = truncate(parsed?.notes, 400) || null;

  return {
    sourceUrl,
    dueDate,
    dueAt: buildIsoDueDate(dueDate, timezone),
    timezone,
    deadlineType,
    deadlineLabel,
    confidence,
    notes,
  };
}

async function fetchScorecardCollege(config, data) {
  const params = new URLSearchParams({
    fields: [
      "id",
      "school.name",
      "school.city",
      "school.state",
      "school.school_url",
    ].join(","),
      per_page: "1",
  });

  if (data.collegeId) {
    params.set("id", String(data.collegeId));
  } else if (data.collegeName) {
    params.set("school.name", String(data.collegeName));
  } else {
    throw new HttpsError(
      "invalid-argument",
      "collegeId or collegeName is required."
    );
  }

  if (config.scorecardApiKey) {
    params.set("api_key", config.scorecardApiKey);
    params.set("keys_nested", "true");
    const response = await fetchWithTimeout(
      `${SCORECARD_BASE_URL}?${params.toString()}`,
      config
    );
    if (response.ok) {
      const json = await response.json().catch(() => ({}));
      const item = json?.results?.[0];
      if (item) {
        return {
          collegeId: truncate(item.id, 64) || truncate(data.collegeId, 64) || null,
          name: truncate(item?.school?.name, 180) || truncate(data.collegeName, 180),
          city: truncate(item?.school?.city, 120) || null,
          state: truncate(item?.school?.state, 80) || null,
          website: normalizeUrl(item?.school?.school_url) ?? normalizeUrl(data.collegeWebsite),
        };
      }
    }
  }

  return {
    collegeId: truncate(data.collegeId, 64) || slugify(data.collegeName),
    name: truncate(data.collegeName, 180),
    city: null,
    state: null,
    website: normalizeUrl(data.collegeWebsite),
  };
}

function buildGreenRiverSeedDocument(now) {
  const dueDate = `${now.getFullYear()}-04-30`;
  const dueAt = buildIsoDueDate(dueDate, "America/Los_Angeles");
  return {
    schemaVersion: 1,
    opportunityId: GREEN_RIVER_FOUNDATION_SCHOLARSHIP_ID,
    type: "scholarship",
    status: "active",
    title: "Green River College Foundation Scholarship",
    organizationName: "Green River College Foundation",
    summary:
      "Annual Green River scholarship application with broad student eligibility and short-answer responses.",
    externalUrl: "https://grcfoundation.awardspring.com/",
    dueAt: Timestamp.fromDate(new Date(dueAt)),
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
      sourceUrl:
        "https://www.greenriver.edu/students/pay-for-college/financial-aid/types-of-aid/scholarships/",
      sourceLabel: "Green River scholarships page",
      model: null,
      fetchedAt: Timestamp.fromDate(now),
      verifiedAt: Timestamp.fromDate(now),
    },
    createdAt: Timestamp.fromDate(now),
    updatedAt: Timestamp.fromDate(now),
  };
}

async function seedGreenRiverFoundationScholarship(requestId) {
  const now = new Date();
  const payload = buildGreenRiverSeedDocument(now);
  await db
    .collection("opportunities")
    .doc(GREEN_RIVER_FOUNDATION_SCHOLARSHIP_ID)
    .set(payload, { merge: true });

  return {
    ok: true,
    requestId,
    seeded: true,
    opportunityId: GREEN_RIVER_FOUNDATION_SCHOLARSHIP_ID,
  };
}

async function upsertCollegeDeadlineOpportunity(data, requestId, config) {
  const college = await fetchScorecardCollege(config, data);
  const deadline = await lookupDeadline(config, college);
  if (!deadline?.dueAt) {
    throw new HttpsError(
      "failed-precondition",
      "A due date could not be extracted from the official source."
    );
  }

  const { month, day } = getMonthDayFromIso(deadline.dueDate);
  const opportunityId = `college-deadline__${slugify(
    college.collegeId || college.name
  )}`;
  const now = new Date();
  const payload = {
    schemaVersion: 1,
    opportunityId,
    type: "college_deadline",
    status: "active",
    title: `${college.name} application deadline`,
    organizationName: college.name,
    summary: truncate(
      `Application deadline for ${college.name}. Verify final requirements and materials on the official admissions page.`,
      300
    ),
    externalUrl: deadline.sourceUrl ?? college.website ?? null,
    dueAt: Timestamp.fromDate(new Date(deadline.dueAt)),
    recurrence: {
      isYearly: month != null && day != null,
      month,
      day,
      timezone: deadline.timezone || "America/Los_Angeles",
    },
    deadline: {
      type: deadline.deadlineType || (deadline.dueAt ? "final" : "rolling"),
      label: deadline.deadlineLabel ?? null,
    },
    matching: {
      financialAidTags: [],
      suggestedMajors: [],
      hasToBeMajor: false,
    },
    eligibility: {
      gpaMin: null,
      residencyTypes: [],
      transferOnly: false,
    },
    requirements: {
      needsRecommendations: false,
      recommendationCountMin: 0,
      essayCount: 0,
    },
    award: {
      amountMin: null,
      amountMax: null,
      currency: "USD",
      amountText: null,
      renewable: null,
    },
    college: {
      collegeId: college.collegeId ?? null,
      collegeName: college.name ?? null,
      city: college.city ?? null,
      state: college.state ?? null,
      website: college.website ?? null,
    },
    source: {
      kind: "ai_college_deadline",
      sourceUrl: deadline.sourceUrl ?? null,
      sourceLabel: "Official admissions page",
      model: config.geminiModel || null,
      fetchedAt: Timestamp.fromDate(now),
      verifiedAt: Timestamp.fromDate(now),
    },
    createdAt: Timestamp.fromDate(now),
    updatedAt: Timestamp.fromDate(now),
  };

  await db.collection("opportunities").doc(opportunityId).set(payload, {
    merge: true,
  });

  return {
    ok: true,
    requestId,
    opportunityId,
    deadlineSourceUrl: deadline.sourceUrl ?? null,
    deadlineDueAt: deadline.dueAt ?? null,
  };
}

async function getOpportunityDoc(opportunityId) {
  const normalizedId = truncate(opportunityId, 160);
  if (!normalizedId) {
    throw new HttpsError("invalid-argument", "Opportunity ID is required.");
  }

  const ref = db.collection("opportunities").doc(normalizedId);
  const snapshot = await ref.get();
  return { ref, snapshot, normalizedId };
}

function buildManualOpportunityPayload(data, now, existingData = null) {
  const title = truncate(data.title, 180);
  if (!title) {
    throw new HttpsError("invalid-argument", "Title is required.");
  }

  const organizationName = truncate(data.organizationName, 180);
  const summary = truncate(data.summary, 600);
  const opportunityId =
    truncate(data.opportunityId, 160) || slugify(title) || `opportunity-${Date.now()}`;
  const timezone = truncate(data.timezone, 80) || "America/Los_Angeles";
  const dueDate = normalizeDateOnly(data.dueDate);
  const isYearly = parseBoolean(data.isYearly, false);
  const deadlineType = normalizeDeadlineType(data.deadlineType);
  const dueAtIso = deadlineType === "rolling" ? null : buildIsoDueDate(dueDate, timezone);
  const { month, day } = getMonthDayFromIso(dueDate);
  const recommendationCountMin = parseNullableInteger(data.recommendationCountMin, 0, 12) ?? 0;
  const essayCount = parseNullableInteger(data.essayCount, 0, 20) ?? 0;

  return {
    opportunityId,
    payload: {
      schemaVersion: 1,
      opportunityId,
      type: normalizeOpportunityType(data.type),
      status: normalizeOpportunityStatus(data.status),
      title,
      organizationName: organizationName || title,
      summary,
      externalUrl:
        normalizeUrl(data.externalUrl) ??
        normalizeUrl(existingData?.externalUrl) ??
        null,
      dueAt: dueAtIso ? Timestamp.fromDate(new Date(dueAtIso)) : null,
      recurrence: {
        isYearly,
        month: isYearly ? month : null,
        day: isYearly ? day : null,
        timezone,
      },
      deadline: {
        type: deadlineType,
        label: truncate(data.deadlineLabel, 160) || null,
      },
      matching: {
        financialAidTags: normalizeTagList(data.financialAidTags, { lowercase: true }),
        suggestedMajors: normalizeTagList(data.suggestedMajors, { lowercase: true }),
        hasToBeMajor: parseBoolean(data.hasToBeMajor, false),
      },
      eligibility: {
        gpaMin: parseNullableNumber(data.gpaMin, 0, 4.5),
        residencyTypes: normalizeTagList(data.residencyTypes, { lowercase: true }),
        transferOnly: parseBoolean(data.transferOnly, false),
      },
      requirements: {
        needsRecommendations:
          recommendationCountMin > 0 || parseBoolean(data.needsRecommendations, false),
        recommendationCountMin,
        essayCount,
      },
      award: {
        amountMin: parseNullableNumber(data.awardAmountMin, 0, 100000000),
        amountMax: parseNullableNumber(data.awardAmountMax, 0, 100000000),
        currency: normalizeCurrency(data.awardCurrency),
        amountText: truncate(data.awardAmountText, 160) || null,
        renewable:
          data.awardRenewable == null || String(data.awardRenewable).trim() === ""
            ? null
            : parseBoolean(data.awardRenewable, false),
      },
      college: {
        collegeId: truncate(data.collegeId, 120) || null,
        collegeName: truncate(data.collegeName, 180) || null,
        city: truncate(data.collegeCity, 120) || null,
        state: truncate(data.collegeState, 80) || null,
        website:
          normalizeUrl(data.collegeWebsite) ??
          normalizeUrl(existingData?.college?.website) ??
          null,
      },
      source: {
        kind: "manual",
        sourceUrl:
          normalizeUrl(data.sourceUrl) ??
          normalizeUrl(existingData?.source?.sourceUrl) ??
          null,
        sourceLabel: truncate(data.sourceLabel, 160) || "Opportunity Admin",
        model: null,
        fetchedAt: existingData?.source?.fetchedAt ?? Timestamp.fromDate(now),
        verifiedAt: Timestamp.fromDate(now),
      },
      createdAt: existingData?.createdAt ?? Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now),
    },
  };
}

async function upsertManualOpportunity(request, requestId) {
  assertOpportunityAdmin(request);
  const now = new Date();
  const requestedId = truncate(request.data?.opportunityId, 160);
  const existingSnapshot = requestedId
    ? await db.collection("opportunities").doc(requestedId).get()
    : null;
  const existingData = existingSnapshot?.exists ? existingSnapshot.data() : null;
  const { opportunityId, payload } = buildManualOpportunityPayload(
    request.data ?? {},
    now,
    existingData
  );

  await db.collection("opportunities").doc(opportunityId).set(payload, {
    merge: true,
  });

  return {
    ok: true,
    requestId,
    opportunityId,
    created: !existingSnapshot?.exists,
    status: payload.status,
  };
}

async function archiveOpportunity(request, requestId) {
  assertOpportunityAdmin(request);
  const { ref, snapshot, normalizedId } = await getOpportunityDoc(
    request.data?.opportunityId
  );
  if (!snapshot.exists) {
    throw new HttpsError("not-found", "Opportunity record was not found.");
  }

  const archived = parseBoolean(request.data?.archived, true);
  await ref.set(
    {
      status: archived ? "archived" : "active",
      updatedAt: Timestamp.fromDate(new Date()),
      source: {
        ...(snapshot.data()?.source ?? {}),
        kind: snapshot.data()?.source?.kind ?? "manual",
        verifiedAt: Timestamp.fromDate(new Date()),
      },
    },
    { merge: true }
  );

  return {
    ok: true,
    requestId,
    opportunityId: normalizedId,
    status: archived ? "archived" : "active",
  };
}

async function deleteOpportunity(request, requestId) {
  assertOpportunityAdmin(request);
  const { ref, snapshot, normalizedId } = await getOpportunityDoc(
    request.data?.opportunityId
  );
  if (!snapshot.exists) {
    throw new HttpsError("not-found", "Opportunity record was not found.");
  }

  await ref.delete();
  return {
    ok: true,
    requestId,
    opportunityId: normalizedId,
    deleted: true,
  };
}

exports.opportunityGateway = onCall(
  {
    region: GATEWAY_REGION,
    timeoutSeconds: 30,
    maxInstances: 3,
  },
  async (request) => {
    assertAuthenticated(request);
    const requestId = crypto.randomUUID();
    const action = truncate(request.data?.action, 80);
    const config = getConfig();

    if (action === "getOpportunityAdminAccess") {
      return {
        ok: true,
        requestId,
        ...getOpportunityAdminDecision(request),
      };
    }

    if (action === "seedGreenRiverFoundationScholarship") {
      return seedGreenRiverFoundationScholarship(requestId);
    }

    if (action === "upsertCollegeDeadlineOpportunity") {
      return upsertCollegeDeadlineOpportunity(request.data ?? {}, requestId, config);
    }

    if (action === "upsertManualOpportunity") {
      return upsertManualOpportunity(request, requestId);
    }

    if (action === "archiveOpportunity") {
      return archiveOpportunity(request, requestId);
    }

    if (action === "deleteOpportunity") {
      return deleteOpportunity(request, requestId);
    }

    throw new HttpsError("invalid-argument", "Unsupported opportunity action.");
  }
);
