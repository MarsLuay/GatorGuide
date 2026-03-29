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
  return String(value ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripHtmlToText(html) {
  return decodeHtmlEntities(
    String(html ?? "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
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
  const confidence = truncate(parsed?.confidence, 80) || null;
  const notes = truncate(parsed?.notes, 400) || null;

  return {
    sourceUrl,
    dueDate,
    dueAt: buildIsoDueDate(dueDate, timezone),
    timezone,
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
    matching: {
      financialAidTags: ["need_based", "merit"],
      suggestedMajors: [],
      hasToBeMajor: false,
    },
    requirements: {
      needsRecommendations: false,
      essayCount: 3,
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
    matching: {
      financialAidTags: [],
      suggestedMajors: [],
      hasToBeMajor: false,
    },
    requirements: {
      needsRecommendations: false,
      essayCount: 0,
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

    if (action === "seedGreenRiverFoundationScholarship") {
      return seedGreenRiverFoundationScholarship(requestId);
    }

    if (action === "upsertCollegeDeadlineOpportunity") {
      return upsertCollegeDeadlineOpportunity(request.data ?? {}, requestId, config);
    }

    throw new HttpsError("invalid-argument", "Unsupported opportunity action.");
  }
);
