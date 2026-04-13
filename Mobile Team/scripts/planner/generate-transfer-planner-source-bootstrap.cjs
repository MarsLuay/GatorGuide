/* global __dirname */
const fs = require("fs");
const path = require("path");

require("ts-node").register({
  skipProject: true,
  transpileOnly: true,
  compilerOptions: {
    module: "CommonJS",
    moduleResolution: "node",
  },
});

const {
  TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACKS,
} = require("../../constants/transfer-planner-source/grc-associate-tracks.generated");
const {
  TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS,
} = require("../../constants/transfer-planner-source/requirement-source-adapters.generated");
const {
  TRANSFER_PLANNER_MAJOR_REQUIREMENT_REGISTRY,
  TRANSFER_PLANNER_DEGREE_MAP_BLOCK_REGISTRY,
  TRANSFER_PLANNER_POLICY_REGISTRY,
  TRANSFER_PLANNER_MAJOR_PATHWAY_REGISTRY,
  TRANSFER_PLANNER_SOURCE_MANIFEST_REGISTRY,
} = require("../../constants/transfer-planner-source/registry");
const {
  TRANSFER_PLANNER_SOURCE_GAP_ENTRIES,
} = require("../../constants/transfer-planner-source/source-gaps.generated");

const OUTPUT_PATH = path.resolve(
  __dirname,
  "..",
  "..",
  "constants",
  "transfer-planner-source",
  "bootstrap.generated.ts"
);
const COURSE_CODE_PATTERN = /\b[A-Z]{2,8}&?\s*\d{3}(?:\.\d+)?[A-Z]?\b/g;
const CAMPUS_TITLE_BY_ID = {
  "uw-seattle": "UW Seattle",
  "uw-bothell": "UW Bothell",
  "uw-tacoma": "UW Tacoma",
};

function makePlanPathwayKey(planId, pathwayId = null) {
  return `${String(planId ?? "").trim()}::${String(pathwayId ?? "").trim()}`;
}

function uniqueStrings(values) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
    )
  );
}

function uniqueLinks(values) {
  const STATUS_RANK = {
    verified: 5,
    "partially-verified": 4,
    "parser-unsupported": 3,
    "source-conflict": 2,
    "source-unfindable": 1,
  };
  const CONFIDENCE_RANK = {
    high: 3,
    medium: 2,
    low: 1,
  };

  const byUrl = new Map();

  for (const value of Array.isArray(values) ? values : []) {
    if (!value || typeof value !== "object") continue;

    const url = String(value.url ?? "").trim();
    const label = String(value.label ?? "").trim();
    const note = String(value.note ?? "").trim();
    const visibility = String(value.visibility ?? "").trim();
    const status = String(value.status ?? "").trim();
    const reason = String(value.reason ?? "").trim();
    const sourceConfidence = String(value.sourceConfidence ?? "").trim();
    if (!url || !label) continue;

    if (!byUrl.has(url)) {
      const initial = { label, url };
      if (note) initial.note = note;
      if (visibility) initial.visibility = visibility;
      if (status) initial.status = status;
      if (reason) initial.reason = reason;
      if (sourceConfidence) initial.sourceConfidence = sourceConfidence;
      byUrl.set(url, initial);
      continue;
    }

    const existing = byUrl.get(url);
    const existingStatusRank = STATUS_RANK[String(existing.status ?? "")] ?? 0;
    const incomingStatusRank = STATUS_RANK[status] ?? 0;
    if (incomingStatusRank > existingStatusRank && status) {
      existing.status = status;
    }

    const existingConfidenceRank = CONFIDENCE_RANK[String(existing.sourceConfidence ?? "")] ?? 0;
    const incomingConfidenceRank = CONFIDENCE_RANK[sourceConfidence] ?? 0;
    if (incomingConfidenceRank > existingConfidenceRank && sourceConfidence) {
      existing.sourceConfidence = sourceConfidence;
    }

    if (!existing.note && note) {
      existing.note = note;
    }
    if (!existing.reason && reason) {
      existing.reason = reason;
    }
    if (
      (!existing.visibility || existing.visibility === "hidden") &&
      visibility === "visible"
    ) {
      existing.visibility = "visible";
    }
    if (!existing.visibility && visibility) {
      existing.visibility = visibility;
    }
  }

  return [...byUrl.values()].sort((left, right) =>
    String(left.label ?? "").localeCompare(String(right.label ?? ""))
  );
}

function makeOwnerKey(planId, pathwayId = null) {
  const normalizedPlanId = String(planId ?? "").trim();
  const normalizedPathwayId = String(pathwayId ?? "").trim();
  return normalizedPathwayId
    ? `pathway:${normalizedPlanId}:${normalizedPathwayId}`
    : `major:${normalizedPlanId}`;
}

function buildSourceStatusForManifestEntry(entry, sourceGapByOwnerKey) {
  const ownerKey = makeOwnerKey(entry.planId, entry.pathwayId ?? null);
  const ownerGap = sourceGapByOwnerKey.get(ownerKey) ?? null;

  if (ownerGap) {
    return {
      visibility: ownerGap.studentVisibility,
      status: ownerGap.sourceCoverageStatus,
      reason: ownerGap.sourceGapReason,
      sourceConfidence: entry.confidence,
    };
  }

  return {
    visibility: "visible",
    status: entry.confidence === "high" ? "verified" : "partially-verified",
    reason: String(entry.note ?? "").trim() || undefined,
    sourceConfidence: entry.confidence,
  };
}

function buildSourceStatusForParsedBlock(block) {
  if (block.ok && !block.usedSnapshotFallback) {
    return {
      visibility: "visible",
      status: "verified",
      reason: undefined,
      sourceConfidence: block.parseConfidence,
    };
  }

  if (block.ok && block.usedSnapshotFallback) {
    return {
      visibility: "visible",
      status: "partially-verified",
      reason: String(block.snapshotFallbackReason ?? "").trim() || undefined,
      sourceConfidence: block.parseConfidence,
    };
  }

  return {
    visibility: "hidden",
    status: "parser-unsupported",
    reason: String(block.error ?? "").trim() || undefined,
    sourceConfidence: block.parseConfidence,
  };
}

function buildShortTitle(title) {
  const normalized = String(title ?? "").trim();
  if (!normalized) return "Major";

  const acronym = normalized
    .split(/\s+/)
    .map((token) => token.replace(/[^A-Za-z]/g, ""))
    .filter(Boolean)
    .map((token) => token[0])
    .join("")
    .toUpperCase();

  if (acronym.length >= 2 && acronym.length <= 8) {
    return acronym;
  }

  return normalized.split(/\s+/).slice(0, 3).join(" ");
}

function mapPhaseToChecklistField(phase) {
  switch (phase) {
    case "before-application":
      return "applicationChecklist";
    case "before-enrollment":
      return "beforeEnrollmentChecklist";
    case "stay-at-grc":
      return "stayAtGrcChecklist";
    default:
      return null;
  }
}

function buildChecklistItem(requirement) {
  const alternatives = (Array.isArray(requirement.alternativeCourseCodeSets)
    ? requirement.alternativeCourseCodeSets
    : []
  ).map((courseSet) => uniqueStrings(courseSet));

  const result = {
    id: String(requirement.id ?? "").trim(),
    title: String(requirement.title ?? "").trim() || String(requirement.uwCourseCode ?? "").trim(),
    grcCourses: uniqueStrings(requirement.grcCourseCodes),
  };

  if (alternatives.some((group) => group.length > 0)) {
    result.alternatives = alternatives.filter((group) => group.length > 0);
  }

  if (typeof requirement.minCompletedCount === "number") {
    result.minCompletedCount = requirement.minCompletedCount;
  }

  const note = String(requirement.note ?? "").trim();
  if (note) {
    result.note = note;
  }

  return result;
}

function buildDegreeMapSection(block) {
  const result = {
    id: String(block.id ?? "").trim(),
    title: String(block.title ?? "").trim(),
    items: uniqueStrings(block.itemLabels),
  };

  const note = String(block.note ?? "").trim();
  if (note) {
    result.note = note;
  }

  return result;
}

function buildCampusesFromParsedRegistries(planRecords) {
  const campusIds = uniqueStrings(planRecords.map((entry) => entry.campusId));

  return campusIds
    .map((campusId) => ({
      id: campusId,
      title: CAMPUS_TITLE_BY_ID[campusId] ?? campusId,
      summary: "Source-generated from parsed UW requirement-source registries.",
      coverageNote:
        "Coverage now follows parsed official-source requirements and generated equivalency mappings.",
      officialLinks: [],
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function buildMajorPlansFromParsedRegistries() {
  const groupedRequirements = new Map();
  for (const requirement of TRANSFER_PLANNER_MAJOR_REQUIREMENT_REGISTRY) {
    const key = makePlanPathwayKey(requirement.planId, requirement.pathwayId ?? null);
    if (!groupedRequirements.has(key)) {
      groupedRequirements.set(key, {
        applicationChecklist: [],
        beforeEnrollmentChecklist: [],
        stayAtGrcChecklist: [],
        sourceLinks: [],
        validationNotes: [],
      });
    }

    const group = groupedRequirements.get(key);
    const checklistField = mapPhaseToChecklistField(requirement.displayPhase);
    if (checklistField) {
      group[checklistField].push(buildChecklistItem(requirement));
    }
    group.sourceLinks.push(...(requirement.sourceLinks ?? []));
    group.validationNotes.push(...(requirement.validationNotes ?? []));
  }

  const groupedDegreeMaps = new Map();
  for (const block of TRANSFER_PLANNER_DEGREE_MAP_BLOCK_REGISTRY) {
    const key = makePlanPathwayKey(block.planId, block.pathwayId ?? null);
    if (!groupedDegreeMaps.has(key)) {
      groupedDegreeMaps.set(key, {
        sections: [],
        sourceLinks: [],
        validationNotes: [],
      });
    }
    const group = groupedDegreeMaps.get(key);
    group.sections.push(buildDegreeMapSection(block));
    group.sourceLinks.push(...(block.sourceLinks ?? []));
    group.validationNotes.push(...(block.validationNotes ?? []));
  }

  const policyByKey = new Map(
    TRANSFER_PLANNER_POLICY_REGISTRY.map((policy) => [
      makePlanPathwayKey(policy.planId, policy.pathwayId ?? null),
      policy,
    ])
  );

  const pathwaysByPlan = new Map();
  for (const pathway of TRANSFER_PLANNER_MAJOR_PATHWAY_REGISTRY) {
    const planId = String(pathway.planId ?? "").trim();
    if (!planId) continue;
    if (!pathwaysByPlan.has(planId)) {
      pathwaysByPlan.set(planId, []);
    }
    pathwaysByPlan.get(planId).push(pathway);
  }

  const parsedBlocksByPlan = new Map();
  for (const block of TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS) {
    const planId = String(block.planId ?? "").trim();
    if (!planId) continue;
    if (!parsedBlocksByPlan.has(planId)) {
      parsedBlocksByPlan.set(planId, []);
    }
    parsedBlocksByPlan.get(planId).push(block);
  }

  const sourceManifestByPlan = new Map();
  const sourceGapByOwnerKey = new Map(
    TRANSFER_PLANNER_SOURCE_GAP_ENTRIES.map((entry) => [entry.ownerKey, entry])
  );
  for (const entry of TRANSFER_PLANNER_SOURCE_MANIFEST_REGISTRY) {
    const planId = String(entry.planId ?? "").trim();
    if (!planId || entry.ownerType !== "major") continue;
    if (!sourceManifestByPlan.has(planId)) {
      sourceManifestByPlan.set(planId, []);
    }
    const sourceStatus = buildSourceStatusForManifestEntry(entry, sourceGapByOwnerKey);
    sourceManifestByPlan.get(planId).push({
      label: entry.label,
      url: entry.url,
      note: entry.note,
      visibility: sourceStatus.visibility,
      status: sourceStatus.status,
      reason: sourceStatus.reason,
      sourceConfidence: sourceStatus.sourceConfidence,
    });
  }

  const planIds = uniqueStrings([
    ...TRANSFER_PLANNER_MAJOR_REQUIREMENT_REGISTRY.map((entry) => entry.planId),
    ...TRANSFER_PLANNER_POLICY_REGISTRY.map((entry) => entry.planId),
    ...TRANSFER_PLANNER_MAJOR_PATHWAY_REGISTRY.map((entry) => entry.planId),
    ...TRANSFER_PLANNER_DEGREE_MAP_BLOCK_REGISTRY.map((entry) => entry.planId),
    ...TRANSFER_PLANNER_PARSED_REQUIREMENT_SOURCE_BLOCKS.map((entry) => entry.planId),
  ]);

  const majorPlans = planIds
    .map((planId) => {
      const planKey = makePlanPathwayKey(planId, null);
      const planPolicy = policyByKey.get(planKey) ?? null;
      const planRequirements = groupedRequirements.get(planKey) ?? {
        applicationChecklist: [],
        beforeEnrollmentChecklist: [],
        stayAtGrcChecklist: [],
        sourceLinks: [],
        validationNotes: [],
      };
      const planDegreeMaps = groupedDegreeMaps.get(planKey) ?? {
        sections: [],
        sourceLinks: [],
        validationNotes: [],
      };
      const parsedBlocks = parsedBlocksByPlan.get(planId) ?? [];
      const parsedAnchorBlock =
        parsedBlocks.find((entry) => !entry.pathwayId) ?? parsedBlocks[0] ?? null;
      const title =
        String(planPolicy?.majorTitle ?? "").trim() ||
        String(parsedAnchorBlock?.ownerTitle ?? "").trim() ||
        planId;
      const campusId = String(
        planPolicy?.campusId ??
          parsedAnchorBlock?.campusId ??
          TRANSFER_PLANNER_MAJOR_PATHWAY_REGISTRY.find((entry) => entry.planId === planId)?.campusId ??
          TRANSFER_PLANNER_MAJOR_REQUIREMENT_REGISTRY.find((entry) => entry.planId === planId)?.campusId ??
          "uw-seattle"
      ).trim();

      const pathEntries = (pathwaysByPlan.get(planId) ?? [])
        .slice()
        .sort((left, right) => String(left.pathwayId ?? "").localeCompare(String(right.pathwayId ?? "")))
        .map((pathway) => {
          const pathwayId = String(pathway.pathwayId ?? "").trim();
          const pathwayKey = makePlanPathwayKey(planId, pathwayId);
          const pathwayPolicy = policyByKey.get(pathwayKey) ?? null;
          const pathwayRequirements = groupedRequirements.get(pathwayKey) ?? {
            applicationChecklist: [],
            beforeEnrollmentChecklist: [],
            stayAtGrcChecklist: [],
            sourceLinks: [],
            validationNotes: [],
          };
          const pathwayDegreeMaps = groupedDegreeMaps.get(pathwayKey) ?? {
            sections: [],
            sourceLinks: [],
            validationNotes: [],
          };

          return {
            id: pathwayId,
            label: String(pathway.label ?? pathwayId).trim(),
            summary: "",
            applicationChecklist: pathwayRequirements.applicationChecklist,
            beforeEnrollmentChecklist: pathwayRequirements.beforeEnrollmentChecklist,
            stayAtGrcChecklist: pathwayRequirements.stayAtGrcChecklist,
            advisorFlags: [],
            officialLinks: uniqueLinks([
              ...(pathway.sourceLinks ?? []),
              ...pathwayRequirements.sourceLinks,
              ...pathwayDegreeMaps.sourceLinks,
            ]),
            degreeMapSections: pathwayDegreeMaps.sections,
            manualReviewNotes: [],
            grcCourseList: uniqueStrings([
              ...(pathway.grcCourseList ?? []),
              ...pathwayRequirements.applicationChecklist.flatMap((item) => item.grcCourses),
              ...pathwayRequirements.beforeEnrollmentChecklist.flatMap((item) => item.grcCourses),
              ...pathwayRequirements.stayAtGrcChecklist.flatMap((item) => item.grcCourses),
            ]),
            grcCourseListGuidance: "",
            plannerNote: "",
            bestTrackId: pathwayPolicy?.bestTrackId ?? null,
            bestTrackSummary: "",
            whyThisTrack: [],
            financialAidNote: "",
          };
        });

      return {
        id: planId,
        campusId,
        title,
        shortTitle: buildShortTitle(title),
        coverage: "detailed",
        summary: "",
        applicationWindow: "",
        startQuarter: "Varies",
        bestTrackId: planPolicy?.bestTrackId ?? null,
        bestTrackSummary: "",
        whyThisTrack: [],
        financialAidNote: "",
        applicationChecklist: planRequirements.applicationChecklist,
        beforeEnrollmentChecklist: planRequirements.beforeEnrollmentChecklist,
        stayAtGrcChecklist: planRequirements.stayAtGrcChecklist,
        advisorFlags: [],
        involvementIdeas: [],
        projectIdeas: [],
        officialLinks: uniqueLinks([
          ...(sourceManifestByPlan.get(planId) ?? []),
          ...(planPolicy?.sourceLinks ?? []),
          ...planRequirements.sourceLinks,
          ...planDegreeMaps.sourceLinks,
          ...parsedBlocks.map((entry) => {
            const sourceStatus = buildSourceStatusForParsedBlock(entry);
            return {
              label: entry.sourceLabel,
              url: entry.sourceUrl,
              visibility: sourceStatus.visibility,
              status: sourceStatus.status,
              reason: sourceStatus.reason,
              sourceConfidence: sourceStatus.sourceConfidence,
            };
          }),
        ]),
        degreeMapSections: planDegreeMaps.sections,
        manualReviewNotes: [],
        grcCourseList: uniqueStrings([
          ...planRequirements.applicationChecklist.flatMap((item) => item.grcCourses),
          ...planRequirements.beforeEnrollmentChecklist.flatMap((item) => item.grcCourses),
          ...planRequirements.stayAtGrcChecklist.flatMap((item) => item.grcCourses),
          ...pathEntries.flatMap((pathway) => pathway.grcCourseList ?? []),
        ]),
        grcCourseListGuidance: "",
        plannerNote: "",
        pathways: pathEntries,
      };
    })
    .sort((left, right) => {
      const campusDelta = String(left.campusId ?? "").localeCompare(String(right.campusId ?? ""));
      if (campusDelta !== 0) return campusDelta;
      return String(left.id ?? "").localeCompare(String(right.id ?? ""));
    });

  return majorPlans;
}

function sanitizePlannerOwnedText(value) {
  return value == null ? "" : String(value);
}

function normalizeOfficialLinks(value) {
  const normalizedLinks = [];
  const seenUrls = new Set();

  for (const rawLink of Array.isArray(value) ? value : []) {
    if (!rawLink || typeof rawLink !== "object") {
      continue;
    }

    const url = String(rawLink.url ?? "").trim();
    if (!url || seenUrls.has(url)) {
      continue;
    }

    seenUrls.add(url);
    normalizedLinks.push(sanitizeValue(rawLink));
  }

  return normalizedLinks;
}

function sanitizeValue(value) {
  if (typeof value === "string") {
    return sanitizePlannerOwnedText(value);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(entry));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [
        key,
        key === "officialLinks" ? normalizeOfficialLinks(entryValue) : sanitizeValue(entryValue),
      ])
    );
  }

  return value;
}

function normalizeCourseCode(value) {
  const normalized = String(value ?? "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
  const match = normalized.match(/^([A-Z&]+(?: [A-Z&]+)*) (\d{3}(?:\.\d+)?[A-Z]?)$/);
  if (!match) {
    return normalized;
  }

  const subjectTokens = match[1].split(" ").filter(Boolean);
  const normalizedSubject = subjectTokens.every((token) => token.length === 1)
    ? subjectTokens.join("")
    : subjectTokens.join(" ");

  return `${normalizedSubject} ${match[2]}`;
}

function collectCourseCodesFromValue(value, targetSet) {
  if (typeof value === "string") {
    const matches = value.match(COURSE_CODE_PATTERN) ?? [];
    for (const match of matches) {
      const normalized = normalizeCourseCode(match);
      if (normalized) {
        targetSet.add(normalized);
      }
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectCourseCodesFromValue(item, targetSet);
    }
    return;
  }

  if (value && typeof value === "object") {
    for (const entryValue of Object.values(value)) {
      collectCourseCodesFromValue(entryValue, targetSet);
    }
  }
}

function toIdSet(values) {
  const set = new Set();
  for (const value of values ?? []) {
    const id = String(value?.id ?? "").trim();
    if (id) {
      set.add(id);
    }
  }
  return set;
}

function diffSets(previous, current) {
  const added = [];
  const removed = [];

  for (const value of current) {
    if (!previous.has(value)) {
      added.push(value);
    }
  }

  for (const value of previous) {
    if (!current.has(value)) {
      removed.push(value);
    }
  }

  added.sort((left, right) => left.localeCompare(right));
  removed.sort((left, right) => left.localeCompare(right));
  return { added, removed };
}

function buildSnapshot(input) {
  const majorIds = toIdSet(input.majorPlans);
  const trackIds = toIdSet(input.tracks);
  const campusIds = toIdSet(input.campuses);
  const courseCodes = new Set();

  collectCourseCodesFromValue(input.majorPlans, courseCodes);
  collectCourseCodesFromValue(input.tracks, courseCodes);

  return {
    majorIds,
    trackIds,
    campusIds,
    courseCodes,
  };
}

function loadPreviousSnapshot() {
  if (!fs.existsSync(OUTPUT_PATH)) {
    return null;
  }

  try {
    delete require.cache[require.resolve(OUTPUT_PATH)];
    const previousModule = require(OUTPUT_PATH);
    return buildSnapshot({
      majorPlans: previousModule.TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS ?? [],
      tracks: previousModule.TRANSFER_PLANNER_BOOTSTRAP_TRACKS ?? [],
      campuses: previousModule.TRANSFER_PLANNER_BOOTSTRAP_CAMPUSES ?? [],
    });
  } catch (error) {
    console.warn(`Unable to read previous bootstrap snapshot: ${error.message}`);
    return null;
  }
}

function printDiffSummary(previousSnapshot, currentSnapshot) {
  if (!previousSnapshot) {
    console.log("Bootstrap summary: no previous snapshot found; skipping added/removed diff.");
    return;
  }

  const majorDiff = diffSets(previousSnapshot.majorIds, currentSnapshot.majorIds);
  const trackDiff = diffSets(previousSnapshot.trackIds, currentSnapshot.trackIds);
  const campusDiff = diffSets(previousSnapshot.campusIds, currentSnapshot.campusIds);
  const courseDiff = diffSets(previousSnapshot.courseCodes, currentSnapshot.courseCodes);

  const preview = (values) => (values.length ? values.slice(0, 12).join(", ") : "none");

  console.log("Bootstrap summary:");
  console.log(
    `- Majors added: ${majorDiff.added.length}; removed: ${majorDiff.removed.length}`
  );
  console.log(
    `- Tracks added: ${trackDiff.added.length}; removed: ${trackDiff.removed.length}`
  );
  console.log(
    `- Campuses added: ${campusDiff.added.length}; removed: ${campusDiff.removed.length}`
  );
  console.log(
    `- Courses added: ${courseDiff.added.length}; removed: ${courseDiff.removed.length}`
  );
  console.log(`  Added majors (sample): ${preview(majorDiff.added)}`);
  console.log(`  Removed majors (sample): ${preview(majorDiff.removed)}`);
  console.log(`  Added courses (sample): ${preview(courseDiff.added)}`);
  console.log(`  Removed courses (sample): ${preview(courseDiff.removed)}`);
}

function serializeExport(name, typeName, value) {
  return `export const ${name}: ${typeName} = ${JSON.stringify(sanitizeValue(value), null, 2)};\n`;
}

const fileContents = `/* eslint-disable */
/* auto-generated by scripts/planner/generate-transfer-planner-source-bootstrap.cjs */

import type {
  TransferPlannerCampus,
  TransferPlannerMajorPlan,
  TransferPlannerTrack,
} from "../transfer-planner-types";

${serializeExport(
  "TRANSFER_PLANNER_BOOTSTRAP_CAMPUSES",
  "TransferPlannerCampus[]",
  buildCampusesFromParsedRegistries(buildMajorPlansFromParsedRegistries())
)}
${serializeExport(
  "TRANSFER_PLANNER_BOOTSTRAP_TRACKS",
  "TransferPlannerTrack[]",
  TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACKS
)}
${serializeExport(
  "TRANSFER_PLANNER_BOOTSTRAP_ALL_MAJOR_PLANS",
  "TransferPlannerMajorPlan[]",
  buildMajorPlansFromParsedRegistries()
)}
`;

const previousSnapshot = loadPreviousSnapshot();

fs.writeFileSync(OUTPUT_PATH, fileContents);
console.log(`Wrote ${OUTPUT_PATH}`);
const currentSnapshot = buildSnapshot({
  majorPlans: buildMajorPlansFromParsedRegistries(),
  tracks: TRANSFER_PLANNER_GENERATED_GRC_ASSOCIATE_TRACKS,
  campuses: buildCampusesFromParsedRegistries(buildMajorPlansFromParsedRegistries()),
});
printDiffSummary(previousSnapshot, currentSnapshot);
