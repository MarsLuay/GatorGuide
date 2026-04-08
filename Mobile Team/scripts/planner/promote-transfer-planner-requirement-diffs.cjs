const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

require("ts-node").register({
  skipProject: true,
  transpileOnly: true,
  compilerOptions: {
    module: "CommonJS",
    moduleResolution: "node",
  },
});

const {
  TRANSFER_PLANNER_MAJOR_REQUIREMENT_REGISTRY,
  TRANSFER_PLANNER_EQUIVALENCY_RULE_REGISTRY,
  TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS,
} = require("../../constants/transfer-planner-source");
const {
  TRANSFER_PLANNER_NORMALIZED_COURSE_METADATA,
} = require("../../constants/transfer-planner-source/course-metadata");
const {
  TRANSFER_PLANNER_PROMOTED_REQUIREMENT_ATOM_OVERRIDES,
} = require("../../constants/transfer-planner-source/requirement-atom-overrides.generated");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const TMP_DIR = path.resolve(REPO_ROOT, ".tmp");
const PARSE_REPORT_PATH = path.resolve(
  TMP_DIR,
  "transfer-planner-requirement-source-parse-report.json"
);
const OUTPUT_PATH = path.resolve(
  REPO_ROOT,
  "constants",
  "transfer-planner-source",
  "requirement-atom-overrides.generated.ts"
);
const OUTPUT_CLASSIFICATION_PATH = path.resolve(
  REPO_ROOT,
  "constants",
  "transfer-planner-source",
  "requirement-diff-classifications.generated.ts"
);
const OUTPUT_JSON_PATH = path.resolve(
  TMP_DIR,
  "transfer-planner-requirement-diff-promotion-report.json"
);
const OUTPUT_MD_PATH = path.resolve(
  TMP_DIR,
  "transfer-planner-requirement-diff-promotion-report.md"
);
const COURSE_CODE_PATTERN = /\b[A-Z&]{1,8}(?:\s+[A-Z&]{1,8}){0,2}\s+\d{3}[A-Z]?\b/g;
const EMBEDDED_COURSE_CODE_PATTERN = /\b(?:[A-Z]{1,3}\s+)?[A-Z]{2,8}\s*\d{3}[A-Z]?\b/g;
const COURSE_CODE_LEADING_STOPWORDS = new Set([
  "AND",
  "BOTH",
  "EITHER",
  "FOR",
  "FROM",
  "OF",
  "ONE",
  "OR",
  "THE",
  "THREE",
  "TO",
  "TWO",
  "WITH",
]);
const CAMPUS_ORDER = ["uw-seattle", "uw-bothell", "uw-tacoma"];
const BEFORE_APPLICATION_PATTERN =
  /\b(admission|admissions|application|prereq|prerequisite|min(?:imum)? course requirements?|minimum requirements?|before entry|declaration requirement)\b/i;
const BEFORE_ENROLLMENT_PATTERN =
  /\b(before the first|before first|before the following|after admission|beyond admission|later adds|adds\b|still needs|needed to complete|to complete the degree|continuation|beyond the admission baseline)\b/i;
const COMBINED_ENTRY_REFERENCE_PATTERN = /combined[- ]entry|combined entries|see .*combined/i;

function hasArg(flag) {
  return process.argv.slice(2).includes(flag);
}

function runRequirementParse() {
  const result = spawnSync("node", ["scripts/planner/parse-transfer-planner-requirement-sources.cjs"], {
    cwd: REPO_ROOT,
    stdio: "inherit",
    shell: false,
  });

  if (result.status !== 0) {
    throw new Error("Requirement-source parsing failed, so diff promotion could not continue.");
  }
}

function normalizeWhitespace(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtmlEntities(value) {
  const entityMap = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&apos;": "'",
    "&nbsp;": " ",
    "&#8211;": "-",
    "&#8212;": "-",
    "&ndash;": "-",
    "&mdash;": "-",
    "&#8216;": "'",
    "&#8217;": "'",
    "&lsquo;": "'",
    "&rsquo;": "'",
    "&#8220;": '"',
    "&#8221;": '"',
    "&ldquo;": '"',
    "&rdquo;": '"',
  };

  return String(value ?? "").replace(
    /&(amp|lt|gt|quot|apos|nbsp|lsquo|rsquo|ldquo|rdquo);|&#(?:39|8211|8212|8216|8217|8220|8221);/gi,
    (match) => entityMap[match] ?? match
  );
}

function normalizeCourseCode(value) {
  return normalizeWhitespace(String(value ?? "").toUpperCase());
}

function normalizeCourseTitle(value) {
  return normalizeWhitespace(
    decodeHtmlEntities(String(value ?? ""))
      .replace(/[’']/g, "")
      .replace(/&/g, " and ")
      .replace(/\bintro\b/gi, "introduction")
      .replace(/\bcalc\b/gi, "calculus")
      .replace(/\b(a|an|the)\b/gi, " ")
      .replace(/\b(a&h|a\/h|ssc|s\/sc|nsc|n\/sc|div|vlpa|i&s|i\/s|qsr|rsn|w|c)\b/gi, " ")
      .replace(/[^A-Za-z0-9]+/g, " ")
  ).toLowerCase();
}

function uniqueSorted(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function getOwnerScopeKey(planId, pathwayId) {
  return `${String(planId)}::${String(pathwayId ?? "")}`;
}

function sanitizeExtractedCourseCode(value) {
  let normalized = normalizeCourseCode(value);
  let parts = normalized.split(" ");

  while (parts.length >= 3 && COURSE_CODE_LEADING_STOPWORDS.has(parts[0])) {
    const candidate = parts.slice(1).join(" ");
    if (!/^[A-Z&]{1,8}(?:\s+[A-Z&]{1,8}){0,2}\s+\d{3}[A-Z]?$/.test(candidate)) {
      break;
    }

    normalized = candidate;
    parts = normalized.split(" ");
  }

  return normalized;
}

function extractCourseCodes(value) {
  return uniqueSorted(
    [...String(value ?? "").toUpperCase().matchAll(COURSE_CODE_PATTERN)].map((match) =>
      sanitizeExtractedCourseCode(match[0])
    )
  );
}

function extractExactUwCourseCode(title) {
  const normalizedTitle = normalizeCourseCode(title);
  const codes = extractCourseCodes(normalizedTitle);
  if (codes.length !== 1) {
    return null;
  }

  return normalizedTitle === codes[0] ? codes[0] : null;
}

function getCatalogNumber(uwCourseCode) {
  const match = normalizeCourseCode(uwCourseCode).match(/\b(\d{3})[A-Z]?\b/);
  return match ? Number.parseInt(match[1], 10) : null;
}

function getCourseCodeParts(uwCourseCode) {
  const normalized = normalizeCourseCode(uwCourseCode);
  const match = normalized.match(/^([A-Z&]+(?:\s+[A-Z&]+){0,2})\s+(\d{3}[A-Z]?)$/);
  if (!match) {
    return null;
  }

  return {
    subjectCode: match[1],
    catalogNumber: match[2],
  };
}

function normalizeCourseFamilySubject(subjectCode) {
  const normalized = normalizeCourseCode(subjectCode);
  switch (normalized) {
    case "PHYS":
    case "TPHYS":
    case "T PHYS":
    case "B PHYS":
    case "BPHYS":
      return "PHYS";
    case "MATH":
    case "TMATH":
    case "T MATH":
    case "STMATH":
    case "B MATH":
    case "BMATH":
      return "MATH";
    case "CHEM":
    case "B CHEM":
    case "BCHEM":
      return "CHEM";
    case "BIOL":
    case "BIO A":
    case "B BIO":
    case "BBIO":
      return "BIOL";
    default:
      return normalized;
  }
}

function buildCourseFamilyKey(uwCourseCode) {
  const parts = getCourseCodeParts(uwCourseCode);
  if (!parts) {
    return null;
  }

  return `${normalizeCourseFamilySubject(parts.subjectCode)} ${parts.catalogNumber}`;
}

function isTransferRelevantUwCourseCode(uwCourseCode, consensus) {
  if (consensus?.grcCourseCodes?.length) {
    return true;
  }

  const catalogNumber = getCatalogNumber(uwCourseCode);
  return catalogNumber !== null && catalogNumber < 300;
}

function buildAlternativeSetKey(group) {
  return group.map((code) => normalizeCourseCode(code)).sort().join(" || ");
}

function buildMappingKey(entry) {
  const grcCourseCodes = [...(entry.grcCourseCodes ?? [])].map((code) => normalizeCourseCode(code)).sort();
  const alternativeCourseCodeSets = (entry.alternativeCourseCodeSets ?? [])
    .map((group) => group.map((code) => normalizeCourseCode(code)).sort())
    .sort((left, right) => left.join(" ").localeCompare(right.join(" ")));

  return JSON.stringify({
    grcCourseCodes,
    alternativeCourseCodeSets,
  });
}

function buildConsensusIndex() {
  const ownersByScope = new Map();
  const consensusByCourse = new Map();
  const consensusByCourseFamily = new Map();
  const promotedOverrideIds = new Set(
    (TRANSFER_PLANNER_PROMOTED_REQUIREMENT_ATOM_OVERRIDES ?? []).map((entry) => entry.id)
  );

  for (const atom of TRANSFER_PLANNER_MAJOR_REQUIREMENT_REGISTRY) {
    if (promotedOverrideIds.has(atom.id)) {
      continue;
    }

    const ownerScopeKey = getOwnerScopeKey(atom.planId, atom.pathwayId);
    const ownerCodes = ownersByScope.get(ownerScopeKey) ?? new Set();
    const exactCourseCode = extractExactUwCourseCode(atom.title);

    if (exactCourseCode) {
      ownerCodes.add(exactCourseCode);
      ownersByScope.set(ownerScopeKey, ownerCodes);
    }

    if (!exactCourseCode || !(atom.grcCourseCodes ?? []).length) {
      continue;
    }

    const mappingKey = buildMappingKey(atom);
    const entryForCourse =
      consensusByCourse.get(exactCourseCode) ??
      {
        totalSamples: 0,
        mappings: new Map(),
      };
    entryForCourse.totalSamples += 1;

    const mappingEntry =
      entryForCourse.mappings.get(mappingKey) ??
      {
        mappingKey,
        grcCourseCodes: [...atom.grcCourseCodes].map((code) => normalizeCourseCode(code)).sort(),
        alternativeCourseCodeSets: (atom.alternativeCourseCodeSets ?? []).map((group) =>
          group.map((code) => normalizeCourseCode(code)).sort()
        ),
        sampleCount: 0,
        phases: new Map(),
      };

    mappingEntry.sampleCount += 1;
    mappingEntry.phases.set(
      atom.displayPhase,
      (mappingEntry.phases.get(atom.displayPhase) ?? 0) + 1
    );
    entryForCourse.mappings.set(mappingKey, mappingEntry);
    consensusByCourse.set(exactCourseCode, entryForCourse);

    const courseFamilyKey = buildCourseFamilyKey(exactCourseCode);
    if (courseFamilyKey) {
      const familyEntryForCourse =
        consensusByCourseFamily.get(courseFamilyKey) ??
        {
          totalSamples: 0,
          mappings: new Map(),
          supportingCourseCodes: new Set(),
        };
      familyEntryForCourse.totalSamples += 1;
      familyEntryForCourse.supportingCourseCodes.add(exactCourseCode);

      const familyMappingEntry =
        familyEntryForCourse.mappings.get(mappingKey) ??
        {
          mappingKey,
          grcCourseCodes: [...atom.grcCourseCodes].map((code) => normalizeCourseCode(code)).sort(),
          alternativeCourseCodeSets: (atom.alternativeCourseCodeSets ?? []).map((group) =>
            group.map((code) => normalizeCourseCode(code)).sort()
          ),
          sampleCount: 0,
          phases: new Map(),
        };

      familyMappingEntry.sampleCount += 1;
      familyMappingEntry.phases.set(
        atom.displayPhase,
        (familyMappingEntry.phases.get(atom.displayPhase) ?? 0) + 1
      );
      familyEntryForCourse.mappings.set(mappingKey, familyMappingEntry);
      consensusByCourseFamily.set(courseFamilyKey, familyEntryForCourse);
    }
  }

  const summarizedConsensus = new Map();
  for (const [uwCourseCode, entry] of consensusByCourse.entries()) {
    const sortedMappings = [...entry.mappings.values()].sort((left, right) => {
      if (right.sampleCount !== left.sampleCount) {
        return right.sampleCount - left.sampleCount;
      }
      return left.mappingKey.localeCompare(right.mappingKey);
    });

    const topMapping = sortedMappings[0];
    const topPhase = [...topMapping.phases.entries()].sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return left[0].localeCompare(right[0]);
    })[0];

    const mappingRatio = topMapping ? topMapping.sampleCount / entry.totalSamples : 0;
    const phaseRatio =
      topPhase && topMapping ? topPhase[1] / topMapping.sampleCount : 0;
    const mappingConfidence =
      topMapping && topMapping.sampleCount >= 2 && mappingRatio >= 0.8 ? "high" : "medium";
    const phaseConfidence =
      topPhase && topPhase[1] >= 2 && phaseRatio >= 0.8
        ? "high"
        : topPhase
          ? "medium"
          : "low";

    summarizedConsensus.set(uwCourseCode, {
      uwCourseCode,
      totalSamples: entry.totalSamples,
      mappingSampleCount: topMapping?.sampleCount ?? 0,
      mappingRatio,
      mappingConfidence,
      grcCourseCodes: topMapping?.grcCourseCodes ?? [],
      alternativeCourseCodeSets: topMapping?.alternativeCourseCodeSets ?? [],
      phase: topPhase?.[0] ?? "stay-at-grc",
      phaseSampleCount: topPhase?.[1] ?? 0,
      phaseRatio,
      phaseConfidence,
    });
  }

  const summarizedCourseFamilyConsensus = new Map();
  for (const [courseFamilyKey, entry] of consensusByCourseFamily.entries()) {
    const sortedMappings = [...entry.mappings.values()].sort((left, right) => {
      if (right.sampleCount !== left.sampleCount) {
        return right.sampleCount - left.sampleCount;
      }
      return left.mappingKey.localeCompare(right.mappingKey);
    });

    const topMapping = sortedMappings[0];
    const topPhase = [...(topMapping?.phases.entries() ?? [])].sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return left[0].localeCompare(right[0]);
    })[0];

    const mappingRatio = topMapping ? topMapping.sampleCount / entry.totalSamples : 0;
    const phaseRatio =
      topPhase && topMapping ? topPhase[1] / topMapping.sampleCount : 0;
    const mappingConfidence =
      topMapping && topMapping.sampleCount >= 2 && mappingRatio >= 0.8 ? "high" : "medium";
    const phaseConfidence =
      topPhase && topPhase[1] >= 2 && phaseRatio >= 0.8
        ? "high"
        : topPhase
          ? "medium"
          : "low";

    summarizedCourseFamilyConsensus.set(courseFamilyKey, {
      courseFamilyKey,
      totalSamples: entry.totalSamples,
      mappingSampleCount: topMapping?.sampleCount ?? 0,
      mappingRatio,
      mappingConfidence,
      grcCourseCodes: topMapping?.grcCourseCodes ?? [],
      alternativeCourseCodeSets: topMapping?.alternativeCourseCodeSets ?? [],
      phase: topPhase?.[0] ?? "stay-at-grc",
      phaseSampleCount: topPhase?.[1] ?? 0,
      phaseRatio,
      phaseConfidence,
      supportingCourseCodes: [...entry.supportingCourseCodes].sort(),
    });
  }

  return {
    ownersByScope,
    summarizedConsensus,
    summarizedCourseFamilyConsensus,
  };
}

function buildCourseMetadataIndex() {
  const uwTitleByCode = new Map();
  const grcCourseEntriesByNormalizedTitle = new Map();

  for (const metadata of TRANSFER_PLANNER_NORMALIZED_COURSE_METADATA ?? []) {
    if (!metadata?.code || !metadata?.title) {
      continue;
    }

    const normalizedCode = normalizeCourseCode(metadata.code);
    const normalizedTitle = normalizeCourseTitle(metadata.title);
    if (!normalizedTitle) {
      continue;
    }

    if (metadata.schoolId === "grc") {
      const existingEntries = grcCourseEntriesByNormalizedTitle.get(normalizedTitle) ?? [];
      if (!existingEntries.some((entry) => entry.code === normalizedCode)) {
        existingEntries.push({
          code: normalizedCode,
          title: normalizeWhitespace(decodeHtmlEntities(metadata.title)),
        });
        existingEntries.sort((left, right) => left.code.localeCompare(right.code));
      }
      grcCourseEntriesByNormalizedTitle.set(normalizedTitle, existingEntries);
      continue;
    }

    if (!uwTitleByCode.has(normalizedCode)) {
      uwTitleByCode.set(normalizedCode, normalizeWhitespace(decodeHtmlEntities(metadata.title)));
    }
  }

  return {
    uwTitleByCode,
    grcCourseEntriesByNormalizedTitle,
  };
}

function buildRequirementCoverageIndex() {
  const coverageByScope = new Map();

  function addChecklistCoverage(ownerScopeKey, checklistItems) {
    const coveredCodes = coverageByScope.get(ownerScopeKey) ?? new Set();
    for (const checklistItem of checklistItems ?? []) {
      for (const code of checklistItem.grcCourses ?? []) {
        coveredCodes.add(normalizeCourseCode(code));
      }
    }
    coverageByScope.set(ownerScopeKey, coveredCodes);
  }

  for (const plan of TRANSFER_PLANNER_SOURCE_GENERATED_MAJOR_PLANS ?? []) {
    const planScopeKey = getOwnerScopeKey(plan.id, null);
    addChecklistCoverage(planScopeKey, [
      ...(plan.applicationChecklist ?? []),
      ...(plan.beforeEnrollmentChecklist ?? []),
      ...(plan.stayAtGrcChecklist ?? []),
    ]);

    for (const pathway of plan.pathways ?? []) {
      const pathwayScopeKey = getOwnerScopeKey(plan.id, pathway.id);
      addChecklistCoverage(pathwayScopeKey, [
        ...(pathway.applicationChecklist ?? plan.applicationChecklist ?? []),
        ...(pathway.beforeEnrollmentChecklist ?? plan.beforeEnrollmentChecklist ?? []),
        ...(pathway.stayAtGrcChecklist ?? plan.stayAtGrcChecklist ?? []),
      ]);
    }
  }

  return coverageByScope;
}

function normalizeSourceCourseSets(sourceCourseSets) {
  return (sourceCourseSets ?? [])
    .map((group) => uniqueSorted((group ?? []).map((code) => normalizeCourseCode(code))))
    .filter((group) => group.length > 0);
}

function isRequirementCoverageSatisfied(coveredCodes, sourceCourseSets) {
  if (!coveredCodes || !sourceCourseSets.length) {
    return false;
  }

  return sourceCourseSets.some((group) => group.every((code) => coveredCodes.has(code)));
}

function addCoveredCourseSets(coveredCodes, sourceCourseSets) {
  for (const group of sourceCourseSets ?? []) {
    for (const code of group) {
      coveredCodes.add(normalizeCourseCode(code));
    }
  }
}

function sortSourceCourseSets(sourceCourseSets) {
  return normalizeSourceCourseSets(sourceCourseSets).sort((left, right) => {
    if (left.length !== right.length) {
      return left.length - right.length;
    }

    return left.join(" ").localeCompare(right.join(" "));
  });
}

function buildSourceCourseSetsKey(sourceCourseSets) {
  return JSON.stringify(sortSourceCourseSets(sourceCourseSets));
}

function getRuleStatusScore(rule) {
  switch (rule.ruleStatus) {
    case "active":
      return 3;
    case "legacy":
      return 2;
    case "deprecated":
      return 1;
    default:
      return 2;
  }
}

function getRuleAcceptanceScore(rule) {
  switch (rule.acceptanceCategory) {
    case "preferred":
      return 4;
    case "accepted":
      return 3;
    case "accepted-with-warning":
      return 2;
    case "legacy-accepted":
      return 1;
    default:
      return 0;
  }
}

function getRuleTypeScore(rule) {
  switch (rule.type) {
    case "direct-course":
      return 5;
    case "full-credit-combo":
      return 4;
    case "sequence":
      return 3;
    case "alternate-path":
      return 2;
    default:
      return 1;
  }
}

function isReferenceOnlyCombinedEntryRule(rule) {
  const searchableText = [
    rule.title,
    rule.sourceCourseLabel,
    ...(rule.notes ?? []),
    ...(rule.plannerWarnings ?? []),
  ]
    .filter(Boolean)
    .join(" ");

  return COMBINED_ENTRY_REFERENCE_PATTERN.test(searchableText);
}

function compareGuideRules(left, right) {
  const referenceOnlyDelta =
    Number(isReferenceOnlyCombinedEntryRule(left)) - Number(isReferenceOnlyCombinedEntryRule(right));
  if (referenceOnlyDelta !== 0) return referenceOnlyDelta;

  const statusDelta = getRuleStatusScore(right) - getRuleStatusScore(left);
  if (statusDelta !== 0) return statusDelta;

  const acceptanceDelta = getRuleAcceptanceScore(right) - getRuleAcceptanceScore(left);
  if (acceptanceDelta !== 0) return acceptanceDelta;

  const typeDelta = getRuleTypeScore(right) - getRuleTypeScore(left);
  if (typeDelta !== 0) return typeDelta;

  const sourceSetLengthDelta =
    (left.sourceCourseSets?.[0]?.length ?? Number.MAX_SAFE_INTEGER) -
    (right.sourceCourseSets?.[0]?.length ?? Number.MAX_SAFE_INTEGER);
  if (sourceSetLengthDelta !== 0) return sourceSetLengthDelta;

  return left.id.localeCompare(right.id);
}

function buildGuideMappingIndex() {
  const mappingsByTargetCourse = new Map();

  for (const rule of TRANSFER_PLANNER_EQUIVALENCY_RULE_REGISTRY) {
    if (rule.sourceKind !== "uw-green-river-equivalency-guide") {
      continue;
    }
    if (rule.acceptanceCategory === "no-credit") {
      continue;
    }
    if (!(rule.targetCourseCodes ?? []).length || !(rule.sourceCourseSets ?? []).length) {
      continue;
    }

    for (const targetCourseCode of rule.targetCourseCodes) {
      const entries = mappingsByTargetCourse.get(targetCourseCode) ?? [];
      entries.push(rule);
      mappingsByTargetCourse.set(targetCourseCode, entries);
    }
  }

  const summarizedMappings = new Map();
  for (const [targetCourseCode, rules] of mappingsByTargetCourse.entries()) {
    const sortedRules = [...rules].sort(compareGuideRules);
    const topRule = sortedRules[0];
    if (!topRule) {
      continue;
    }

    const classificationKind = isReferenceOnlyCombinedEntryRule(topRule)
      ? "source-backed-guide-reference-only-equivalent"
      : topRule.type === "direct-course"
        ? "auto-promoted-guide-direct-equivalent"
        : "source-backed-guide-sequence-equivalent";

    summarizedMappings.set(targetCourseCode, {
      targetCourseCode,
      topRule,
      classificationKind,
      referenceOnly: isReferenceOnlyCombinedEntryRule(topRule),
      hasMultipleRuleOptions: sortedRules.length > 1,
    });
  }

  return summarizedMappings;
}

function readSnapshotLines(snapshotPath) {
  if (!snapshotPath || !fs.existsSync(snapshotPath)) {
    return [];
  }

  return fs
    .readFileSync(snapshotPath, "utf8")
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);
}

function getRelevantOwnerCourseLines(owner, uwCourseCode) {
  const normalizedNeedle = normalizeCourseCode(uwCourseCode);
  const seen = new Set();
  const lines = [];

  for (const sourceLine of [
    ...readSnapshotLines(owner.snapshotPath),
    ...(owner.requirementCueLines ?? []),
  ]) {
    const normalizedLine = normalizeWhitespace(String(sourceLine ?? "").toUpperCase());
    if (!normalizedLine.includes(normalizedNeedle)) {
      continue;
    }

    const cleanedLine = normalizeWhitespace(decodeHtmlEntities(sourceLine));
    if (!cleanedLine || seen.has(cleanedLine)) {
      continue;
    }
    seen.add(cleanedLine);
    lines.push(cleanedLine);
  }

  return lines;
}

function extractTitleCandidateFromRequirementLine(uwCourseCode, line) {
  const parts = getCourseCodeParts(uwCourseCode);
  const normalizedLine = normalizeWhitespace(decodeHtmlEntities(line));
  if (!parts || !normalizedLine) {
    return "";
  }

  const leadingPattern = new RegExp(
    `^(?:[A-Z]{1,3}\\s+)?${parts.subjectCode}\\s*${parts.catalogNumber}\\s*[:\\-–—]?\\s*`,
    "i"
  );

  return normalizeWhitespace(
    normalizedLine
      .replace(/^[*•-]\s*/, "")
      .replace(leadingPattern, "")
      .replace(/^\([^)]*\)\s*/, "")
  );
}

function stripTitleNoise(value) {
  return normalizeWhitespace(
    decodeHtmlEntities(value)
      .replace(/\([^)]*\bcredits?\b[^)]*\)/gi, " ")
      .replace(/\b(?:A&H|A\/H|SSc|S\/Sc|NSc|N\/Sc|DIV|VLPA|I&S|I\/S|QSR|RSN|W|C)\b(?:\s*[,/]\s*\b(?:A&H|A\/H|SSc|S\/Sc|NSc|N\/Sc|DIV|VLPA|I&S|I\/S|QSR|RSN|W|C)\b)*/gi, " ")
      .replace(/\s+/g, " ")
  );
}

function isGenericTopicTitle(value) {
  return /^(special topics|independent study|seminar|internship|thesis|research|workshop|topics? in|directed study|fieldwork)$/i.test(
    stripTitleNoise(value)
  );
}

function isChoiceLikeTitle(value) {
  const preparedValue = stripTitleNoise(value);
  return (
    /\b(or|equivalent|recommended|choose|select|pick|credits?|minimum|one of|two of|three of|either|max(?:imum)?|combined|consider|and\/or|only one|up to)\b/i.test(
      preparedValue
    ) || Boolean(preparedValue.match(EMBEDDED_COURSE_CODE_PATTERN))
  );
}

function isCleanTitleCandidate(value) {
  const preparedValue = stripTitleNoise(value);
  if (!preparedValue) {
    return false;
  }
  if (isGenericTopicTitle(preparedValue)) {
    return false;
  }
  if (isChoiceLikeTitle(preparedValue)) {
    return false;
  }
  return true;
}

function isCampusSpecificUwCourseCode(uwCourseCode) {
  const subjectCode = normalizeCourseCode(uwCourseCode).split(" ")[0] ?? "";
  return (
    /^(B|T|ST)[A-Z]/.test(subjectCode) ||
    /^(BIS|BBUS|BMATH|BPHYS|BEARTH|BHS|TCOM|TARTS|TAMST|TLIT|TWRT|THIST|TBIOL|TMATH|STMATH|TPOLS|TPSYCH|TESC|TEGL|TLAX)$/.test(
      subjectCode
    )
  );
}

function buildTitleMatchCandidate(owner, uwCourseCode, courseMetadataIndex) {
  const normalizedCode = normalizeCourseCode(uwCourseCode);
  const candidateTitles = [];

  const metadataTitle = courseMetadataIndex.uwTitleByCode.get(normalizedCode);
  if (metadataTitle) {
    candidateTitles.push({
      title: metadataTitle,
      source: "catalog-metadata",
    });
  }

  for (const line of getRelevantOwnerCourseLines(owner, uwCourseCode)) {
    const extractedTitle = extractTitleCandidateFromRequirementLine(uwCourseCode, line);
    if (!extractedTitle) {
      continue;
    }
    const normalizedTitle = normalizeCourseTitle(extractedTitle);
    if (
      normalizedTitle &&
      !candidateTitles.some((candidate) => normalizeCourseTitle(candidate.title) === normalizedTitle)
    ) {
      candidateTitles.push({
        title: extractedTitle,
        source: "parsed-source-cue",
      });
    }
  }

  let exactTitleMatch = null;
  let titleMetadata = null;

  for (const candidate of candidateTitles) {
    const preparedTitle = stripTitleNoise(candidate.title);
    const normalizedTitle = normalizeCourseTitle(preparedTitle);
    if (!normalizedTitle) {
      continue;
    }

    const matches =
      courseMetadataIndex.grcCourseEntriesByNormalizedTitle.get(normalizedTitle) ?? [];

    if (!titleMetadata) {
      titleMetadata = {
        title: preparedTitle,
        normalizedTitle,
        source: candidate.source,
      };
    }

    if (!isCleanTitleCandidate(preparedTitle)) {
      continue;
    }

    if (!exactTitleMatch) {
      exactTitleMatch = {
        title: preparedTitle,
        normalizedTitle,
        source: candidate.source,
        matches,
      };
    }

    if (matches.length === 1) {
      exactTitleMatch = {
        title: preparedTitle,
        normalizedTitle,
        source: candidate.source,
        matches,
      };
      break;
    }
  }

  return {
    titleMetadata,
    exactTitleMatch,
    hasChoiceLikeTitle: candidateTitles.some((candidate) => isChoiceLikeTitle(candidate.title)),
    hasGenericTopicTitle: candidateTitles.some((candidate) => isGenericTopicTitle(candidate.title)),
    hasCatalogMetadataTitle: Boolean(metadataTitle),
  };
}

function inferPhase(owner, uwCourseCode, consensus) {
  const snapshotLines = readSnapshotLines(owner.snapshotPath);
  const matchingLines = snapshotLines.filter((line) => line.includes(uwCourseCode)).slice(0, 8);
  const relevantText = [...matchingLines, ...(owner.requirementCueLines ?? [])].join(" | ");

  if (BEFORE_ENROLLMENT_PATTERN.test(relevantText)) {
    return {
      phase: "before-enrollment",
      phaseConfidence: "high",
      matchedLines: matchingLines,
    };
  }

  if (BEFORE_APPLICATION_PATTERN.test(relevantText)) {
    return {
      phase: "before-application",
      phaseConfidence: "high",
      matchedLines: matchingLines,
    };
  }

  return {
    phase: consensus.phase,
    phaseConfidence: consensus.phaseConfidence,
    matchedLines: matchingLines,
  };
}

function normalizeCampusLabel(campusId) {
  switch (campusId) {
    case "uw-seattle":
      return "UW Seattle";
    case "uw-bothell":
      return "UW Bothell";
    case "uw-tacoma":
      return "UW Tacoma";
    default:
      return campusId;
  }
}

function formatHumanDate(isoString) {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Los_Angeles",
  }).format(date);
}

function buildGeneratedNote(phase, uwCourseCode) {
  const subjectCode = normalizeCourseCode(uwCourseCode).split(" ")[0];

  if (phase === "before-application") {
    return `The current official degree page names ${uwCourseCode} in the early transfer-preparation set, so keep the clean Green River equivalent in place before applying when that route matches the student's plan.`;
  }

  if (phase === "before-enrollment") {
    if (/^(MATH|STAT|TMATH|STMATH)$/.test(subjectCode)) {
      return "Not part of the minimum transfer-admission classes, but good to complete before or during UW enrollment because the degree still needs this math requirement either way.";
    }
    if (/^(PHYS|TPHYS|BPHYS)$/.test(subjectCode)) {
      return "Not part of the minimum transfer-admission classes, but good to complete before or during UW enrollment because the degree still needs this physics requirement either way.";
    }
    if (/^(CHEM|BCHEM)$/.test(subjectCode)) {
      return "Not part of the minimum transfer-admission classes, but good to complete before or during UW enrollment because the degree still needs this chemistry requirement either way.";
    }
    if (/^(BIOL|BBIO|NURS|NUTR)$/.test(subjectCode)) {
      return "Not part of the minimum transfer-admission classes, but good to complete before or during UW enrollment because the degree still needs this life-science requirement either way.";
    }
    if (/^(CSE|CS|TCSS|CSS|INFO|AMATH|ENGR)$/.test(subjectCode)) {
      return "Not part of the minimum transfer-admission classes, but good to complete before or during UW enrollment because the degree still needs this computing or technical requirement either way.";
    }

    return "Not part of the minimum transfer-admission classes, but good to complete before or during UW enrollment because it's needed to complete the degree either way.";
  }

  if (/^(MATH|STAT|TMATH|STMATH|PHYS|TPHYS|CHEM|BCHEM|BIOL|BBIO|CS|CSE|TCSS|CSS|INFO|ENGR|AMATH)$/.test(subjectCode)) {
    return "Useful to complete at Green River when it cleanly matches the published degree page, even if the department does not treat it as part of the minimum admission-side checklist.";
  }

  return "Useful to complete at Green River when it cleanly matches the published degree page, but confirm the exact timing with an advisor if the major has multiple internal routes.";
}

function buildClassificationNote(classificationKind, uwCourseCode, promoted = false) {
  switch (classificationKind) {
    case "auto-promoted-exact-consensus":
      return `Auto-promoted because the current source-backed planner already has a strong exact-title consensus for ${uwCourseCode}.`;
    case "auto-promoted-single-sample-consensus":
      return `Auto-promoted because ${uwCourseCode} has a clean single-sample exact-title consensus with no conflicting planner mapping.`;
    case "auto-promoted-guide-direct-equivalent":
      return `Auto-promoted because the official UW Green River equivalency guide provides a clean direct Green River transfer match for ${uwCourseCode}.`;
    case "auto-promoted-guide-sequence-equivalent":
      return `Auto-promoted because the official UW Green River equivalency guide maps ${uwCourseCode} through a valid multi-course Green River sequence that the planner was missing.`;
    case "auto-promoted-guide-reference-only-equivalent":
      return `Auto-promoted because ${uwCourseCode} only appears in the official guide through a combined-entry rule, and the planner was missing that source-backed Green River course path.`;
    case "auto-promoted-exact-title-metadata-match":
      return `Auto-promoted because ${uwCourseCode} has a single clean exact-title match in the current Green River course catalog metadata.`;
    case "auto-promoted-exact-title-alternative-paths":
      return `Auto-promoted because ${uwCourseCode} has multiple clean exact-title Green River matches, and the planner now exposes all of those published paths instead of dropping the requirement.`;
    case "auto-promoted-course-family-consensus":
      return `Auto-promoted because ${uwCourseCode} matches a stable lower-division UW course family that already maps cleanly to the same Green River path elsewhere in the planner.`;
    case "auto-promoted-choice-set-resolved":
      return `Auto-promoted because the published UW requirement line groups ${uwCourseCode} with other source-backed options that already resolve to real Green River prep paths.`;
    case "source-backed-guide-sequence-equivalent":
      return promoted
        ? `Auto-promoted because the official UW Green River equivalency guide maps ${uwCourseCode} through a sequence or multi-course Green River equivalency and the planner was missing that GRC path.`
        : `Classified automatically because the official UW Green River equivalency guide maps ${uwCourseCode} through a sequence or multi-course Green River equivalency, not a simple one-course transfer match.`;
    case "source-backed-guide-reference-only-equivalent":
      return promoted
        ? `Auto-promoted because ${uwCourseCode} only appears in the guide through a reference-only combined-entry row and the planner was missing that source-backed GRC path.`
        : `Classified automatically because ${uwCourseCode} only appears in the guide through a reference-only combined-entry row, so it should not auto-create a standalone planner requirement atom.`;
    case "source-backed-choice-set-no-public-grc-path":
      return `Classified automatically because ${uwCourseCode} only appears in published alternate or choice-based requirement lines that still do not expose a public Green River prep path.`;
    case "source-backed-generic-topic-course":
      return `Classified automatically because ${uwCourseCode} is a generic topics, seminar, or independent-study style course without a stable single-course Green River prep match.`;
    case "source-backed-exact-title-multiple-grc-matches":
      return `Classified automatically because ${uwCourseCode} has multiple exact-title Green River catalog matches, so the planner avoids picking one automatically.`;
    case "source-backed-campus-specific-no-public-grc-equivalent":
      return `Classified automatically because ${uwCourseCode} is a source-backed campus-specific lower-division UW course, but no public Green River equivalent is currently provable.`;
    case "source-backed-no-public-grc-equivalent":
    default:
      return `Classified automatically because ${uwCourseCode} is source-backed, but the current public Green River sources do not prove an equivalent planner path.`;
  }
}

function sanitizeStringLiteral(value) {
  return JSON.stringify(String(value ?? ""));
}

function buildGeneratedFile(entries) {
  const lines = [
    "export type TransferPlannerPromotedRequirementAtomOverride = {",
    "  ownerId: string;",
    "  planId: string;",
    "  pathwayId?: string | null;",
    '  campusId: "uw-seattle" | "uw-bothell" | "uw-tacoma";',
    "  majorTitle: string;",
    "  id: string;",
    "  title: string;",
    "  grcCourseCodes: string[];",
    "  alternativeCourseCodeSets: string[][];",
    '  phase: "before-application" | "before-enrollment" | "stay-at-grc";',
    '  displayPhase: "before-application" | "before-enrollment" | "stay-at-grc";',
    "  note: string;",
    "  sourceLinks: Array<{",
    "    label: string;",
    "    url: string;",
    "    note?: string;",
    "  }>;",
    "  validationNotes: string[];",
    "  sourceUwCourseCode: string;",
    '  mappingConfidence: "high" | "medium";',
    '  phaseConfidence: "high" | "medium" | "low";',
    "  promotedOn: string;",
    "  rationale: string;",
    "};",
    "",
    "// Generated by scripts/planner/promote-transfer-planner-requirement-diffs.cjs",
    "export const TRANSFER_PLANNER_PROMOTED_REQUIREMENT_ATOM_OVERRIDES: TransferPlannerPromotedRequirementAtomOverride[] = [",
  ];

  for (const entry of entries) {
    lines.push("  {");
    lines.push(`    ownerId: ${sanitizeStringLiteral(entry.ownerId)},`);
    lines.push(`    planId: ${sanitizeStringLiteral(entry.planId)},`);
    if (entry.pathwayId) {
      lines.push(`    pathwayId: ${sanitizeStringLiteral(entry.pathwayId)},`);
    }
    lines.push(`    campusId: ${sanitizeStringLiteral(entry.campusId)},`);
    lines.push(`    majorTitle: ${sanitizeStringLiteral(entry.majorTitle)},`);
    lines.push(`    id: ${sanitizeStringLiteral(entry.id)},`);
    lines.push(`    title: ${sanitizeStringLiteral(entry.title)},`);
    lines.push(
      `    grcCourseCodes: [${entry.grcCourseCodes.map((code) => sanitizeStringLiteral(code)).join(", ")}],`
    );
    lines.push("    alternativeCourseCodeSets: [");
    for (const group of entry.alternativeCourseCodeSets) {
      lines.push(
        `      [${group.map((code) => sanitizeStringLiteral(code)).join(", ")}],`
      );
    }
    lines.push("    ],");
    lines.push(`    phase: ${sanitizeStringLiteral(entry.phase)},`);
    lines.push(`    displayPhase: ${sanitizeStringLiteral(entry.displayPhase)},`);
    lines.push(`    note: ${sanitizeStringLiteral(entry.note)},`);
    lines.push("    sourceLinks: [");
    for (const link of entry.sourceLinks) {
      lines.push("      {");
      lines.push(`        label: ${sanitizeStringLiteral(link.label)},`);
      lines.push(`        url: ${sanitizeStringLiteral(link.url)},`);
      if (link.note) {
        lines.push(`        note: ${sanitizeStringLiteral(link.note)},`);
      }
      lines.push("      },");
    }
    lines.push("    ],");
    lines.push("    validationNotes: [");
    for (const note of entry.validationNotes) {
      lines.push(`      ${sanitizeStringLiteral(note)},`);
    }
    lines.push("    ],");
    lines.push(`    sourceUwCourseCode: ${sanitizeStringLiteral(entry.sourceUwCourseCode)},`);
    lines.push(`    mappingConfidence: ${sanitizeStringLiteral(entry.mappingConfidence)},`);
    lines.push(`    phaseConfidence: ${sanitizeStringLiteral(entry.phaseConfidence)},`);
    lines.push(`    promotedOn: ${sanitizeStringLiteral(entry.promotedOn)},`);
    lines.push(`    rationale: ${sanitizeStringLiteral(entry.rationale)},`);
    lines.push("  },");
  }

  lines.push("];");
  lines.push("");
  return lines.join("\n");
}

function buildClassificationGeneratedFile(report) {
  const lines = [
    'import type {',
    '  TransferPlannerRequirementDiffClassificationEntry,',
    '  TransferPlannerRequirementDiffClassificationSummary,',
    '} from "./schema";',
    "",
    "// Generated by scripts/planner/promote-transfer-planner-requirement-diffs.cjs",
    `export const TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATION_SUMMARY = ${JSON.stringify(
      report.classificationSummary,
      null,
      2
    )} as TransferPlannerRequirementDiffClassificationSummary;`,
    "",
    `export const TRANSFER_PLANNER_REQUIREMENT_DIFF_CLASSIFICATIONS = JSON.parse(${JSON.stringify(
      JSON.stringify(report.classifiedEntries)
    )}) as TransferPlannerRequirementDiffClassificationEntry[];`,
    "",
  ];

  return lines.join("\n");
}

function buildReportMarkdown(report) {
  const lines = [
    "# Transfer Planner Requirement Diff Promotion Report",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `- Parsed owners inspected: ${report.totalOwners}`,
    `- Auto-promoted requirement overrides: ${report.promotedCount}`,
    `- Automatically classified parsed diffs: ${report.classifiedCount}`,
    `- Non-promoted classified source-backed course codes: ${report.nonPromotedClassificationCount}`,
    `- Historical unresolved review-needed bucket count: ${report.reviewCandidateCount}`,
    `- Historical unresolved unmapped bucket count: ${report.unmappedCount}`,
    "",
    "This report is the follow-up step after parsing primary requirement sources. Every source-backed UW course coverage gap is now assigned an automatic machine classification. Clean Green River mappings are auto-promoted into generated planner requirement atoms; the rest stay source-backed but non-promoted.",
    "",
  ];

  if (report.classificationSummary) {
    lines.push("## Classification Summary", "");
    for (const [classificationKind, count] of Object.entries(
      report.classificationSummary.countsByKind ?? {}
    ).sort((left, right) => right[1] - left[1])) {
      lines.push(`- ${classificationKind}: ${count}`);
    }
    lines.push("");
  }

  for (const campusId of CAMPUS_ORDER) {
    const campusPromoted = report.promotedEntries.filter((entry) => entry.campusId === campusId);
    const campusClassified = report.classifiedEntries.filter((entry) => entry.campusId === campusId);
    const campusNonPromoted = campusClassified.filter(
      (entry) => !entry.promotedRequirementAtomOverrideId
    );

    if (!campusPromoted.length && !campusNonPromoted.length) {
      continue;
    }

    lines.push(`## ${normalizeCampusLabel(campusId)}`, "");

    if (campusPromoted.length) {
      lines.push("### Auto-promoted requirement atoms", "");
      for (const entry of campusPromoted.slice(0, 50)) {
        lines.push(`#### ${entry.majorTitle}`);
        lines.push("");
        lines.push(`- UW course: ${entry.sourceUwCourseCode}`);
        lines.push(`- Planner phase: ${entry.displayPhase}`);
        lines.push(`- Green River match: ${entry.grcCourseCodes.join(", ")}`);
        lines.push(`- Source: ${entry.sourceLinks[0]?.url ?? "n/a"}`);
        lines.push(`- Rationale: ${entry.rationale}`);
        lines.push("");
      }
    }

    if (campusNonPromoted.length) {
      lines.push("### Automatically classified non-promoted source-backed UW courses", "");
      for (const entry of campusNonPromoted.slice(0, 50)) {
        lines.push(`- ${entry.majorTitle}`);
        lines.push(`  - UW course: ${entry.sourceUwCourseCode}`);
        lines.push(`  - Classification: ${entry.classificationKind}`);
        if (entry.grcCourseCodes.length) {
          lines.push(`  - Guide-backed Green River set: ${entry.grcCourseCodes.join(", ")}`);
        }
        if (entry.displayPhase) {
          lines.push(`  - Suggested phase: ${entry.displayPhase}`);
        }
        lines.push(`  - Reason: ${entry.rationale}`);
      }
      lines.push("");
    }
  }

  fs.writeFileSync(OUTPUT_MD_PATH, `${lines.join("\n")}\n`);
}

function isSingleSampleConsensusPromotion(owner, consensus, phaseInference) {
  return (
    owner.parseConfidence === "high" &&
    consensus.mappingConfidence === "medium" &&
    consensus.mappingSampleCount === 1 &&
    consensus.totalSamples === 1 &&
    consensus.mappingRatio === 1 &&
    phaseInference.phaseConfidence !== "low"
  );
}

function buildClassificationEntry({
  owner,
  sourceUwCourseCode,
  classificationKind,
  promotedRequirementAtomOverrideId = null,
  guideRule = null,
  displayPhase = null,
  mappingConfidence = null,
  phaseConfidence = null,
  grcCourseCodes = [],
  alternativeCourseCodeSets = [],
  note,
  rationale,
  validationNotes = [],
  extraSourceLinks = [],
}) {
  return {
    id: `${owner.planId}${owner.pathwayId ? `:pathway:${owner.pathwayId}` : ""}:classified:${sourceUwCourseCode
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")}`,
    ownerId: owner.ownerId,
    planId: owner.planId,
    pathwayId: owner.pathwayId ?? null,
    campusId: owner.campusId,
    majorTitle: owner.ownerTitle,
    sourceUwCourseCode,
    classificationKind,
    promotedRequirementAtomOverrideId,
    guideRuleId: guideRule?.id ?? null,
    displayPhase,
    mappingConfidence,
    phaseConfidence,
    grcCourseCodes: [...grcCourseCodes],
    alternativeCourseCodeSets: (alternativeCourseCodeSets ?? []).map((group) => [...group]),
    note,
    rationale,
    sourceLinks: [
      {
        label: owner.sourceLabel || "Primary degree requirements source",
        url: owner.sourceUrl,
      },
      ...extraSourceLinks,
    ],
    validationNotes,
  };
}

function buildPromotionReport(parseReport) {
  const { ownersByScope, summarizedConsensus, summarizedCourseFamilyConsensus } =
    buildConsensusIndex();
  const requirementCoverageByScope = buildRequirementCoverageIndex();
  const guideMappingsByTargetCourse = buildGuideMappingIndex();
  const courseMetadataIndex = buildCourseMetadataIndex();
  const generatedAt = new Date().toISOString();
  const humanDate = formatHumanDate(generatedAt);
  const promotedEntries = [];
  const classifiedEntries = [];
  const titleMatchCandidateCache = new Map();
  const resolvedSourceCourseSetsCache = new Map();

  function getTitleMatchCandidateCached(owner, uwCourseCode) {
    const cacheKey = `${owner.ownerId}::${owner.pathwayId ?? ""}::${uwCourseCode}`;
    if (!titleMatchCandidateCache.has(cacheKey)) {
      titleMatchCandidateCache.set(
        cacheKey,
        buildTitleMatchCandidate(owner, uwCourseCode, courseMetadataIndex)
      );
    }

    return titleMatchCandidateCache.get(cacheKey);
  }

  function resolveSourceCourseSetsForCourse(owner, uwCourseCode) {
    const cacheKey = `${owner.ownerId}::${owner.pathwayId ?? ""}::${uwCourseCode}`;
    if (resolvedSourceCourseSetsCache.has(cacheKey)) {
      return resolvedSourceCourseSetsCache.get(cacheKey);
    }

    const consensus = summarizedConsensus.get(uwCourseCode);
    const guideMapping = guideMappingsByTargetCourse.get(uwCourseCode);
    if (guideMapping?.topRule) {
      const resolved = {
        sourceCourseSets: sortSourceCourseSets(guideMapping.topRule.sourceCourseSets),
        sourceKind: guideMapping.classificationKind,
        mappingConfidence: "high",
      };
      resolvedSourceCourseSetsCache.set(cacheKey, resolved);
      return resolved;
    }

    if (consensus?.grcCourseCodes?.length && isTransferRelevantUwCourseCode(uwCourseCode, consensus)) {
      const resolved = {
        sourceCourseSets: sortSourceCourseSets([
          consensus.grcCourseCodes,
          ...(consensus.alternativeCourseCodeSets ?? []),
        ]),
        sourceKind:
          consensus.mappingConfidence === "high"
            ? "auto-promoted-exact-consensus"
            : "auto-promoted-single-sample-consensus",
        mappingConfidence: consensus.mappingConfidence,
      };
      resolvedSourceCourseSetsCache.set(cacheKey, resolved);
      return resolved;
    }

    const titleMatchCandidate = getTitleMatchCandidateCached(owner, uwCourseCode);
    const exactTitleMatches = titleMatchCandidate.exactTitleMatch?.matches ?? [];
    if (titleMatchCandidate.exactTitleMatch && exactTitleMatches.length > 0) {
      const resolved = {
        sourceCourseSets: sortSourceCourseSets(exactTitleMatches.map((match) => [match.code])),
        sourceKind:
          exactTitleMatches.length === 1
            ? "auto-promoted-exact-title-metadata-match"
            : "auto-promoted-exact-title-alternative-paths",
        mappingConfidence: "medium",
      };
      resolvedSourceCourseSetsCache.set(cacheKey, resolved);
      return resolved;
    }

    const courseFamilyKey = buildCourseFamilyKey(uwCourseCode);
    const courseFamilyConsensus = courseFamilyKey
      ? summarizedCourseFamilyConsensus.get(courseFamilyKey)
      : null;
    if (
      courseFamilyConsensus?.grcCourseCodes?.length &&
      courseFamilyConsensus.mappingConfidence === "high"
    ) {
      const resolved = {
        sourceCourseSets: sortSourceCourseSets([
          courseFamilyConsensus.grcCourseCodes,
          ...(courseFamilyConsensus.alternativeCourseCodeSets ?? []),
        ]),
        sourceKind: "auto-promoted-course-family-consensus",
        mappingConfidence: courseFamilyConsensus.mappingConfidence,
      };
      resolvedSourceCourseSetsCache.set(cacheKey, resolved);
      return resolved;
    }

    resolvedSourceCourseSetsCache.set(cacheKey, null);
    return null;
  }

  function resolveChoiceSetSourceCourseSets(owner, uwCourseCode) {
    const normalizedTargetCode = normalizeCourseCode(uwCourseCode);
    let bestResolution = null;

    for (const line of getRelevantOwnerCourseLines(owner, uwCourseCode)) {
      const lineCourseCodes = extractCourseCodes(line);
      if (
        lineCourseCodes.length < 2 ||
        !lineCourseCodes.includes(normalizedTargetCode) ||
        !isChoiceLikeTitle(line)
      ) {
        continue;
      }

      const groupMap = new Map();
      const supportingCourseCodes = new Set();
      const resolutionKinds = new Set();

      for (const lineCourseCode of lineCourseCodes) {
        const resolved = resolveSourceCourseSetsForCourse(owner, lineCourseCode);
        if (!resolved?.sourceCourseSets?.length) {
          continue;
        }

        supportingCourseCodes.add(lineCourseCode);
        resolutionKinds.add(resolved.sourceKind);

        for (const sourceCourseSet of resolved.sourceCourseSets) {
          const normalizedGroup = uniqueSorted(
            sourceCourseSet.map((code) => normalizeCourseCode(code))
          );
          if (!normalizedGroup.length) {
            continue;
          }

          const groupKey = normalizedGroup.join(" || ");
          const groupEntry = groupMap.get(groupKey) ?? {
            group: normalizedGroup,
            supportingCourseCodes: new Set(),
          };
          groupEntry.supportingCourseCodes.add(lineCourseCode);
          groupMap.set(groupKey, groupEntry);
        }
      }

      if (!groupMap.size) {
        continue;
      }

      const resolution = {
        sourceCourseSets: sortSourceCourseSets(
          [...groupMap.values()].map((entry) => entry.group)
        ),
        supportingCourseCodes: [...supportingCourseCodes].sort(),
        resolutionKinds: [...resolutionKinds].sort(),
        supportingLines: [line],
      };

      if (
        !bestResolution ||
        resolution.supportingCourseCodes.length > bestResolution.supportingCourseCodes.length ||
        (
          resolution.supportingCourseCodes.length === bestResolution.supportingCourseCodes.length &&
          resolution.sourceCourseSets.length > bestResolution.sourceCourseSets.length
        ) ||
        (
          resolution.supportingCourseCodes.length === bestResolution.supportingCourseCodes.length &&
          resolution.sourceCourseSets.length === bestResolution.sourceCourseSets.length &&
          line.length < bestResolution.supportingLines[0].length
        )
      ) {
        bestResolution = resolution;
      }
    }

    return bestResolution;
  }

  for (const owner of parseReport.owners ?? []) {
    if (!owner.ok || !owner.planId || !owner.campusId || owner.campusId === "grc") {
      continue;
    }

    const ownerScopeKey = getOwnerScopeKey(owner.planId, owner.pathwayId);
    const coveredGrcCourseCodes = requirementCoverageByScope.get(ownerScopeKey) ?? new Set();
    requirementCoverageByScope.set(ownerScopeKey, coveredGrcCourseCodes);

    const sourceOnlyCourseCodes = new Set(uniqueSorted(owner.sourceOnlyUwCourseCodes ?? []));
    const parsedUwCourseCodes = uniqueSorted([
      ...(owner.parsedUwCourseCodes ?? []),
      ...(owner.sourceOnlyUwCourseCodes ?? []),
    ]);

    for (const uwCourseCode of parsedUwCourseCodes) {
      const isSourceOnly = sourceOnlyCourseCodes.has(uwCourseCode);
      const consensus = summarizedConsensus.get(uwCourseCode);
      const guideMapping = guideMappingsByTargetCourse.get(uwCourseCode);
      const guideRule = guideMapping?.topRule ?? null;

      if (
        !isSourceOnly &&
        !guideRule &&
        !(consensus?.grcCourseCodes?.length) &&
        !isTransferRelevantUwCourseCode(uwCourseCode, consensus)
      ) {
        continue;
      }

      const fallbackPhaseInference = inferPhase(owner, uwCourseCode, consensus ?? {
        phase: "stay-at-grc",
        phaseConfidence: "low",
      });
      const guideSourceCourseSets = guideRule
        ? normalizeSourceCourseSets(guideRule.sourceCourseSets)
        : [];
      const consensusSourceCourseSets =
        consensus?.grcCourseCodes?.length
          ? normalizeSourceCourseSets([
              consensus.grcCourseCodes,
              ...(consensus.alternativeCourseCodeSets ?? []),
            ])
          : [];
      const guideCoverageSatisfied = isRequirementCoverageSatisfied(
        coveredGrcCourseCodes,
        guideSourceCourseSets
      );
      const consensusCoverageSatisfied = isRequirementCoverageSatisfied(
        coveredGrcCourseCodes,
        consensusSourceCourseSets
      );

      if (
        guideRule &&
        !guideCoverageSatisfied &&
        owner.parseConfidence !== "low"
      ) {
        const [primarySourceSet = [], ...alternativeSourceSets] = guideSourceCourseSets;
        const guidePromotionKind =
          guideMapping.classificationKind === "auto-promoted-guide-direct-equivalent"
            ? "auto-promoted-guide-direct-equivalent"
            : guideMapping.classificationKind === "source-backed-guide-reference-only-equivalent"
              ? "auto-promoted-guide-reference-only-equivalent"
              : "auto-promoted-guide-sequence-equivalent";
        const rationale = [
          `Parsed from the current primary degree page with ${owner.parseConfidence} source-parse confidence.`,
          `The official UW Green River equivalency guide includes ${uwCourseCode} under ${guideRule.id}.`,
          `The planner was missing the source-backed Green River course path ${primarySourceSet.join(", ")} for this UW requirement.`,
        ].join(" ");
        const extraSourceLinks = (guideRule.sourceLinks ?? []).map((link) => ({
          ...link,
          note: link.note ?? "Official UW Green River equivalency guide rule.",
        }));
        const candidate = {
          ownerId: owner.ownerId,
          planId: owner.planId,
          pathwayId: owner.pathwayId ?? null,
          campusId: owner.campusId,
          majorTitle: owner.ownerTitle,
          id: `${owner.planId}${owner.pathwayId ? `:pathway:${owner.pathwayId}` : ""}:${fallbackPhaseInference.phase}:auto-${uwCourseCode
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")}`,
          title: uwCourseCode,
          grcCourseCodes: [...primarySourceSet],
          alternativeCourseCodeSets: alternativeSourceSets.map((group) => [...group]),
          phase: fallbackPhaseInference.phase,
          displayPhase: fallbackPhaseInference.phase,
          note: buildGeneratedNote(fallbackPhaseInference.phase, uwCourseCode),
          sourceLinks: [
            {
              label: owner.sourceLabel || "Primary degree requirements source",
              url: owner.sourceUrl,
              note: `Auto-promoted from the parsed primary degree page on ${humanDate}.`,
            },
            ...extraSourceLinks,
          ],
          validationNotes: [
            `Auto-promoted source-backed Green River coverage gap on ${humanDate}.`,
            `Source parse confidence: ${owner.parseConfidence}.`,
            `Guide-backed rule: ${guideRule.id}.`,
            `Added the Green River course path ${primarySourceSet.join(", ")} because the current planner rows did not expose it yet.`,
            ...(fallbackPhaseInference.matchedLines.length
              ? [
                  `Requirement cue lines: ${fallbackPhaseInference.matchedLines
                    .slice(0, 3)
                    .join(" | ")}`,
                ]
              : []),
          ],
          sourceUwCourseCode: uwCourseCode,
          mappingConfidence: "high",
          phaseConfidence: fallbackPhaseInference.phaseConfidence,
          promotedOn: generatedAt.slice(0, 10),
          rationale,
        };

        promotedEntries.push(candidate);
        classifiedEntries.push(
          buildClassificationEntry({
            owner,
            sourceUwCourseCode: uwCourseCode,
            classificationKind: guidePromotionKind,
            promotedRequirementAtomOverrideId: candidate.id,
            guideRule,
            displayPhase: fallbackPhaseInference.phase,
            mappingConfidence: "high",
            phaseConfidence: fallbackPhaseInference.phaseConfidence,
            grcCourseCodes: candidate.grcCourseCodes,
            alternativeCourseCodeSets: candidate.alternativeCourseCodeSets,
            note: buildClassificationNote(guidePromotionKind, uwCourseCode, true),
            rationale,
            validationNotes: candidate.validationNotes,
            extraSourceLinks,
          })
        );
        addCoveredCourseSets(coveredGrcCourseCodes, [
          candidate.grcCourseCodes,
          ...candidate.alternativeCourseCodeSets,
        ]);
        continue;
      }

      if (
        !guideRule &&
        consensus?.grcCourseCodes?.length &&
        !consensusCoverageSatisfied &&
        isTransferRelevantUwCourseCode(uwCourseCode, consensus)
      ) {
        const phaseInference = inferPhase(owner, uwCourseCode, consensus);
        const rationale = [
          `Parsed from the current primary degree page with ${owner.parseConfidence} source-parse confidence.`,
          `The planner already has ${consensus.mappingSampleCount}/${consensus.totalSamples} exact-title requirement samples mapping ${uwCourseCode} to ${consensus.grcCourseCodes.join(", ")}.`,
          `The current planner rows were still missing that clean Green River course path for this major.`,
          `Phase inference is ${phaseInference.phaseConfidence} confidence and resolves to ${phaseInference.phase}.`,
        ].join(" ");

        const candidate = {
          ownerId: owner.ownerId,
          planId: owner.planId,
          pathwayId: owner.pathwayId ?? null,
          campusId: owner.campusId,
          majorTitle: owner.ownerTitle,
          id: `${owner.planId}${owner.pathwayId ? `:pathway:${owner.pathwayId}` : ""}:${phaseInference.phase}:auto-${uwCourseCode
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")}`,
          title: uwCourseCode,
          grcCourseCodes: [...consensus.grcCourseCodes],
          alternativeCourseCodeSets: (consensus.alternativeCourseCodeSets ?? []).map((group) => [
            ...group,
          ]),
          phase: phaseInference.phase,
          displayPhase: phaseInference.phase,
          note: buildGeneratedNote(phaseInference.phase, uwCourseCode),
          sourceLinks: [
            {
              label: owner.sourceLabel || "Primary degree requirements source",
              url: owner.sourceUrl,
              note: `Auto-promoted from the parsed primary degree page on ${humanDate}.`,
            },
          ],
          validationNotes: [
            `Auto-promoted source-backed Green River coverage gap on ${humanDate}.`,
            `Source parse confidence: ${owner.parseConfidence}.`,
            `Requirement-mapping consensus: ${consensus.mappingSampleCount}/${consensus.totalSamples} exact-title samples for ${uwCourseCode}.`,
            `Added the Green River course path ${consensus.grcCourseCodes.join(", ")} because the current planner rows did not expose it yet.`,
            ...(phaseInference.matchedLines.length
              ? [`Requirement cue lines: ${phaseInference.matchedLines.slice(0, 3).join(" | ")}`]
              : []),
          ],
          sourceUwCourseCode: uwCourseCode,
          mappingConfidence: consensus.mappingConfidence,
          phaseConfidence: phaseInference.phaseConfidence,
          promotedOn: generatedAt.slice(0, 10),
          rationale,
        };

        const shouldPromoteHighConsensus =
          owner.parseConfidence === "high" &&
          consensus.mappingConfidence === "high";
        const shouldPromoteSingleSample = isSingleSampleConsensusPromotion(
          owner,
          consensus,
          phaseInference
        );

        if (shouldPromoteHighConsensus || shouldPromoteSingleSample) {
          promotedEntries.push(candidate);
          classifiedEntries.push(
            buildClassificationEntry({
              owner,
              sourceUwCourseCode: uwCourseCode,
              classificationKind: shouldPromoteHighConsensus
                ? "auto-promoted-exact-consensus"
                : "auto-promoted-single-sample-consensus",
              promotedRequirementAtomOverrideId: candidate.id,
              displayPhase: phaseInference.phase,
              mappingConfidence: consensus.mappingConfidence,
              phaseConfidence: phaseInference.phaseConfidence,
              grcCourseCodes: candidate.grcCourseCodes,
              alternativeCourseCodeSets: candidate.alternativeCourseCodeSets,
              note: buildClassificationNote(
                shouldPromoteHighConsensus
                  ? "auto-promoted-exact-consensus"
                  : "auto-promoted-single-sample-consensus",
                uwCourseCode
              ),
              rationale,
              validationNotes: candidate.validationNotes,
            })
          );
          addCoveredCourseSets(coveredGrcCourseCodes, [
            candidate.grcCourseCodes,
            ...candidate.alternativeCourseCodeSets,
          ]);
          continue;
        }
      }

      if (!isSourceOnly || !isTransferRelevantUwCourseCode(uwCourseCode, consensus)) {
        continue;
      }

      if (guideRule) {
        if (guideCoverageSatisfied) {
          continue;
        }

        const [primarySourceSet = [], ...alternativeSourceSets] = guideSourceCourseSets;
        const rationale = [
          `Parsed from the current primary degree page with ${owner.parseConfidence} source-parse confidence.`,
          `The official UW Green River equivalency guide includes ${uwCourseCode} under ${guideRule.id}.`,
          guideMapping.classificationKind === "auto-promoted-guide-direct-equivalent"
            ? `The best guide-backed match is a clean direct-course equivalency to ${primarySourceSet.join(", ")}.`
            : `The best guide-backed match is a ${guideRule.type} rule, but the current promotion pass could not safely auto-promote it yet.`,
        ].join(" ");
        const validationNotes = [
          `Automatically classified parsed requirement diff on ${humanDate}.`,
          `Source parse confidence: ${owner.parseConfidence}.`,
          `Guide-backed rule: ${guideRule.id}.`,
          ...(fallbackPhaseInference.matchedLines.length
            ? [
                `Requirement cue lines: ${fallbackPhaseInference.matchedLines
                  .slice(0, 3)
                  .join(" | ")}`,
              ]
            : []),
        ];
        const extraSourceLinks = (guideRule.sourceLinks ?? []).map((link) => ({
          ...link,
          note: link.note ?? "Official UW Green River equivalency guide rule.",
        }));

        classifiedEntries.push(
          buildClassificationEntry({
            owner,
            sourceUwCourseCode: uwCourseCode,
            classificationKind: guideMapping.classificationKind,
            guideRule,
            displayPhase:
              fallbackPhaseInference.phaseConfidence === "low"
                ? null
                : fallbackPhaseInference.phase,
            mappingConfidence: "high",
            phaseConfidence: fallbackPhaseInference.phaseConfidence,
            grcCourseCodes: primarySourceSet,
            alternativeCourseCodeSets: alternativeSourceSets,
            note: buildClassificationNote(guideMapping.classificationKind, uwCourseCode),
            rationale,
            validationNotes,
            extraSourceLinks,
          })
        );
        continue;
      }

      if (consensus?.grcCourseCodes?.length && consensusCoverageSatisfied) {
        continue;
      }

      const titleMatchCandidate = getTitleMatchCandidateCached(owner, uwCourseCode);
      const courseFamilyKey = buildCourseFamilyKey(uwCourseCode);
      const courseFamilyConsensus = courseFamilyKey
        ? summarizedCourseFamilyConsensus.get(courseFamilyKey)
        : null;
      const exactTitleMatches = titleMatchCandidate.exactTitleMatch?.matches ?? [];
      const exactTitleCoverageSatisfied =
        exactTitleMatches.length === 0
          ? false
          : isRequirementCoverageSatisfied(
              coveredGrcCourseCodes,
              exactTitleMatches.map((match) => [match.code])
            );

      if (
        titleMatchCandidate.exactTitleMatch &&
        exactTitleMatches.length === 1 &&
        !exactTitleCoverageSatisfied &&
        owner.parseConfidence !== "low" &&
        fallbackPhaseInference.phaseConfidence !== "low"
      ) {
        const matchedGrcCourse = exactTitleMatches[0];
        const rationale = [
          `Parsed from the current primary degree page with ${owner.parseConfidence} source-parse confidence.`,
          `The planner's course catalog metadata shows a single clean exact-title match between ${uwCourseCode} (${titleMatchCandidate.exactTitleMatch.title}) and ${matchedGrcCourse.code} (${matchedGrcCourse.title}).`,
          `That exact-title Green River path was not already exposed in the current planner rows.`,
        ].join(" ");
        const candidate = {
          ownerId: owner.ownerId,
          planId: owner.planId,
          pathwayId: owner.pathwayId ?? null,
          campusId: owner.campusId,
          majorTitle: owner.ownerTitle,
          id: `${owner.planId}${owner.pathwayId ? `:pathway:${owner.pathwayId}` : ""}:${fallbackPhaseInference.phase}:auto-${uwCourseCode
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")}`,
          title: uwCourseCode,
          grcCourseCodes: [matchedGrcCourse.code],
          alternativeCourseCodeSets: [],
          phase: fallbackPhaseInference.phase,
          displayPhase: fallbackPhaseInference.phase,
          note: buildGeneratedNote(fallbackPhaseInference.phase, uwCourseCode),
          sourceLinks: [
            {
              label: owner.sourceLabel || "Primary degree requirements source",
              url: owner.sourceUrl,
              note: `Auto-promoted from the parsed primary degree page on ${humanDate}.`,
            },
          ],
          validationNotes: [
            `Auto-promoted source-backed Green River coverage gap on ${humanDate}.`,
            `Source parse confidence: ${owner.parseConfidence}.`,
            `Exact-title match source: ${titleMatchCandidate.exactTitleMatch.source}.`,
            `Matched source title: ${titleMatchCandidate.exactTitleMatch.title}.`,
            `Matched Green River title: ${matchedGrcCourse.title}.`,
            ...(fallbackPhaseInference.matchedLines.length
              ? [
                  `Requirement cue lines: ${fallbackPhaseInference.matchedLines
                    .slice(0, 3)
                    .join(" | ")}`,
                ]
              : []),
          ],
          sourceUwCourseCode: uwCourseCode,
          mappingConfidence: "medium",
          phaseConfidence: fallbackPhaseInference.phaseConfidence,
          promotedOn: generatedAt.slice(0, 10),
          rationale,
        };

        promotedEntries.push(candidate);
        classifiedEntries.push(
          buildClassificationEntry({
            owner,
            sourceUwCourseCode: uwCourseCode,
            classificationKind: "auto-promoted-exact-title-metadata-match",
            promotedRequirementAtomOverrideId: candidate.id,
            displayPhase: fallbackPhaseInference.phase,
            mappingConfidence: "medium",
            phaseConfidence: fallbackPhaseInference.phaseConfidence,
            grcCourseCodes: candidate.grcCourseCodes,
            note: buildClassificationNote(
              "auto-promoted-exact-title-metadata-match",
              uwCourseCode
            ),
            rationale,
            validationNotes: candidate.validationNotes,
          })
        );
        addCoveredCourseSets(coveredGrcCourseCodes, [candidate.grcCourseCodes]);
        continue;
      }

      if (
        titleMatchCandidate.exactTitleMatch &&
        exactTitleMatches.length > 1 &&
        !exactTitleCoverageSatisfied &&
        owner.parseConfidence !== "low" &&
        fallbackPhaseInference.phaseConfidence !== "low"
      ) {
        const exactTitleSourceCourseSets = sortSourceCourseSets(
          exactTitleMatches.map((match) => [match.code])
        );
        const [primarySourceSet = [], ...alternativeSourceSets] = exactTitleSourceCourseSets;
        const rationale = [
          `Parsed from the current primary degree page with ${owner.parseConfidence} source-parse confidence.`,
          `${uwCourseCode} has multiple clean exact-title Green River matches for ${titleMatchCandidate.exactTitleMatch.title}.`,
          `The planner now exposes each published Green River alternative path instead of dropping that source-backed requirement row.`,
        ].join(" ");
        const candidate = {
          ownerId: owner.ownerId,
          planId: owner.planId,
          pathwayId: owner.pathwayId ?? null,
          campusId: owner.campusId,
          majorTitle: owner.ownerTitle,
          id: `${owner.planId}${owner.pathwayId ? `:pathway:${owner.pathwayId}` : ""}:${fallbackPhaseInference.phase}:auto-${uwCourseCode
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")}`,
          title: uwCourseCode,
          grcCourseCodes: [...primarySourceSet],
          alternativeCourseCodeSets: alternativeSourceSets.map((group) => [...group]),
          phase: fallbackPhaseInference.phase,
          displayPhase: fallbackPhaseInference.phase,
          note: buildGeneratedNote(fallbackPhaseInference.phase, uwCourseCode),
          sourceLinks: [
            {
              label: owner.sourceLabel || "Primary degree requirements source",
              url: owner.sourceUrl,
              note: `Auto-promoted from the parsed primary degree page on ${humanDate}.`,
            },
          ],
          validationNotes: [
            `Auto-promoted source-backed Green River coverage gap on ${humanDate}.`,
            `Source parse confidence: ${owner.parseConfidence}.`,
            `Exact-title match source: ${titleMatchCandidate.exactTitleMatch.source}.`,
            `Matched source title: ${titleMatchCandidate.exactTitleMatch.title}.`,
            `Published Green River alternatives: ${exactTitleSourceCourseSets
              .map((group) => group.join(" + "))
              .join(" | ")}.`,
            ...(fallbackPhaseInference.matchedLines.length
              ? [
                  `Requirement cue lines: ${fallbackPhaseInference.matchedLines
                    .slice(0, 3)
                    .join(" | ")}`,
                ]
              : []),
          ],
          sourceUwCourseCode: uwCourseCode,
          mappingConfidence: "medium",
          phaseConfidence: fallbackPhaseInference.phaseConfidence,
          promotedOn: generatedAt.slice(0, 10),
          rationale,
        };

        promotedEntries.push(candidate);
        classifiedEntries.push(
          buildClassificationEntry({
            owner,
            sourceUwCourseCode: uwCourseCode,
            classificationKind: "auto-promoted-exact-title-alternative-paths",
            promotedRequirementAtomOverrideId: candidate.id,
            displayPhase: fallbackPhaseInference.phase,
            mappingConfidence: "medium",
            phaseConfidence: fallbackPhaseInference.phaseConfidence,
            grcCourseCodes: candidate.grcCourseCodes,
            alternativeCourseCodeSets: candidate.alternativeCourseCodeSets,
            note: buildClassificationNote(
              "auto-promoted-exact-title-alternative-paths",
              uwCourseCode
            ),
            rationale,
            validationNotes: candidate.validationNotes,
          })
        );
        addCoveredCourseSets(coveredGrcCourseCodes, [
          candidate.grcCourseCodes,
          ...candidate.alternativeCourseCodeSets,
        ]);
        continue;
      }

      const familyConsensusSourceCourseSets =
        courseFamilyConsensus?.grcCourseCodes?.length
          ? normalizeSourceCourseSets([
              courseFamilyConsensus.grcCourseCodes,
              ...(courseFamilyConsensus.alternativeCourseCodeSets ?? []),
            ])
          : [];
      const familyConsensusCoverageSatisfied = isRequirementCoverageSatisfied(
        coveredGrcCourseCodes,
        familyConsensusSourceCourseSets
      );

      if (familyConsensusSourceCourseSets.length && familyConsensusCoverageSatisfied) {
        continue;
      }

      if (
        courseFamilyConsensus?.grcCourseCodes?.length &&
        !familyConsensusCoverageSatisfied &&
        owner.parseConfidence === "high" &&
        courseFamilyConsensus.mappingConfidence === "high" &&
        fallbackPhaseInference.phaseConfidence !== "low"
      ) {
        const rationale = [
          `Parsed from the current primary degree page with ${owner.parseConfidence} source-parse confidence.`,
          `${uwCourseCode} falls under the existing ${courseFamilyConsensus.courseFamilyKey} lower-division UW course family, which already maps consistently to ${courseFamilyConsensus.grcCourseCodes.join(", ")} across ${courseFamilyConsensus.mappingSampleCount}/${courseFamilyConsensus.totalSamples} planner samples.`,
          `Supporting UW course codes: ${courseFamilyConsensus.supportingCourseCodes.join(", ")}.`,
          `The current planner rows were still missing that stable Green River course path for this major.`,
        ].join(" ");
        const candidate = {
          ownerId: owner.ownerId,
          planId: owner.planId,
          pathwayId: owner.pathwayId ?? null,
          campusId: owner.campusId,
          majorTitle: owner.ownerTitle,
          id: `${owner.planId}${owner.pathwayId ? `:pathway:${owner.pathwayId}` : ""}:${fallbackPhaseInference.phase}:auto-${uwCourseCode
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")}`,
          title: uwCourseCode,
          grcCourseCodes: [...courseFamilyConsensus.grcCourseCodes],
          alternativeCourseCodeSets: (courseFamilyConsensus.alternativeCourseCodeSets ?? []).map(
            (group) => [...group]
          ),
          phase: fallbackPhaseInference.phase,
          displayPhase: fallbackPhaseInference.phase,
          note: buildGeneratedNote(fallbackPhaseInference.phase, uwCourseCode),
          sourceLinks: [
            {
              label: owner.sourceLabel || "Primary degree requirements source",
              url: owner.sourceUrl,
              note: `Auto-promoted from the parsed primary degree page on ${humanDate}.`,
            },
          ],
          validationNotes: [
            `Auto-promoted source-backed Green River coverage gap on ${humanDate}.`,
            `Source parse confidence: ${owner.parseConfidence}.`,
            `Course-family consensus: ${courseFamilyConsensus.mappingSampleCount}/${courseFamilyConsensus.totalSamples} samples for ${courseFamilyConsensus.courseFamilyKey}.`,
            `Supporting UW course codes: ${courseFamilyConsensus.supportingCourseCodes.join(", ")}.`,
            `Added the Green River course path ${courseFamilyConsensus.grcCourseCodes.join(", ")} because the current planner rows did not expose it yet.`,
            ...(fallbackPhaseInference.matchedLines.length
              ? [
                  `Requirement cue lines: ${fallbackPhaseInference.matchedLines
                    .slice(0, 3)
                    .join(" | ")}`,
                ]
              : []),
          ],
          sourceUwCourseCode: uwCourseCode,
          mappingConfidence: courseFamilyConsensus.mappingConfidence,
          phaseConfidence: fallbackPhaseInference.phaseConfidence,
          promotedOn: generatedAt.slice(0, 10),
          rationale,
        };

        promotedEntries.push(candidate);
        classifiedEntries.push(
          buildClassificationEntry({
            owner,
            sourceUwCourseCode: uwCourseCode,
            classificationKind: "auto-promoted-course-family-consensus",
            promotedRequirementAtomOverrideId: candidate.id,
            displayPhase: fallbackPhaseInference.phase,
            mappingConfidence: courseFamilyConsensus.mappingConfidence,
            phaseConfidence: fallbackPhaseInference.phaseConfidence,
            grcCourseCodes: candidate.grcCourseCodes,
            alternativeCourseCodeSets: candidate.alternativeCourseCodeSets,
            note: buildClassificationNote("auto-promoted-course-family-consensus", uwCourseCode),
            rationale,
            validationNotes: candidate.validationNotes,
          })
        );
        addCoveredCourseSets(coveredGrcCourseCodes, [
          candidate.grcCourseCodes,
          ...candidate.alternativeCourseCodeSets,
        ]);
        continue;
      }

      const choiceSetResolution = resolveChoiceSetSourceCourseSets(owner, uwCourseCode);
      const choiceSetCoverageSatisfied = choiceSetResolution
        ? isRequirementCoverageSatisfied(
            coveredGrcCourseCodes,
            choiceSetResolution.sourceCourseSets
          )
        : false;

      if (choiceSetResolution?.sourceCourseSets?.length && choiceSetCoverageSatisfied) {
        continue;
      }

      if (
        choiceSetResolution?.sourceCourseSets?.length &&
        !choiceSetCoverageSatisfied &&
        owner.parseConfidence !== "low" &&
        fallbackPhaseInference.phaseConfidence !== "low"
      ) {
        const [primarySourceSet = [], ...alternativeSourceSets] =
          choiceSetResolution.sourceCourseSets;
        const rationale = [
          `Parsed from the current primary degree page with ${owner.parseConfidence} source-parse confidence.`,
          `${uwCourseCode} only appeared in alternate or choice-based requirement lines, so the planner resolved the published Green River prep paths from the same source-backed choice set.`,
          `Supporting UW choice-set codes: ${choiceSetResolution.supportingCourseCodes.join(", ")}.`,
          `Published Green River options now exposed: ${choiceSetResolution.sourceCourseSets
            .map((group) => group.join(" + "))
            .join(" | ")}.`,
        ].join(" ");
        const candidate = {
          ownerId: owner.ownerId,
          planId: owner.planId,
          pathwayId: owner.pathwayId ?? null,
          campusId: owner.campusId,
          majorTitle: owner.ownerTitle,
          id: `${owner.planId}${owner.pathwayId ? `:pathway:${owner.pathwayId}` : ""}:${fallbackPhaseInference.phase}:auto-${uwCourseCode
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")}`,
          title: uwCourseCode,
          grcCourseCodes: [...primarySourceSet],
          alternativeCourseCodeSets: alternativeSourceSets.map((group) => [...group]),
          phase: fallbackPhaseInference.phase,
          displayPhase: fallbackPhaseInference.phase,
          note: buildGeneratedNote(fallbackPhaseInference.phase, uwCourseCode),
          sourceLinks: [
            {
              label: owner.sourceLabel || "Primary degree requirements source",
              url: owner.sourceUrl,
              note: `Auto-promoted from the parsed primary degree page on ${humanDate}.`,
            },
          ],
          validationNotes: [
            `Auto-promoted source-backed Green River coverage gap on ${humanDate}.`,
            `Source parse confidence: ${owner.parseConfidence}.`,
            `Choice-set supporting UW codes: ${choiceSetResolution.supportingCourseCodes.join(", ")}.`,
            `Choice-set resolution strategies: ${choiceSetResolution.resolutionKinds.join(", ")}.`,
            ...(choiceSetResolution.supportingLines.length
              ? [
                  `Requirement cue lines: ${choiceSetResolution.supportingLines
                    .slice(0, 3)
                    .join(" | ")}`,
                ]
              : []),
          ],
          sourceUwCourseCode: uwCourseCode,
          mappingConfidence: "medium",
          phaseConfidence: fallbackPhaseInference.phaseConfidence,
          promotedOn: generatedAt.slice(0, 10),
          rationale,
        };

        promotedEntries.push(candidate);
        classifiedEntries.push(
          buildClassificationEntry({
            owner,
            sourceUwCourseCode: uwCourseCode,
            classificationKind: "auto-promoted-choice-set-resolved",
            promotedRequirementAtomOverrideId: candidate.id,
            displayPhase: fallbackPhaseInference.phase,
            mappingConfidence: "medium",
            phaseConfidence: fallbackPhaseInference.phaseConfidence,
            grcCourseCodes: candidate.grcCourseCodes,
            alternativeCourseCodeSets: candidate.alternativeCourseCodeSets,
            note: buildClassificationNote("auto-promoted-choice-set-resolved", uwCourseCode),
            rationale,
            validationNotes: candidate.validationNotes,
          })
        );
        addCoveredCourseSets(coveredGrcCourseCodes, [
          candidate.grcCourseCodes,
          ...candidate.alternativeCourseCodeSets,
        ]);
        continue;
      }

      if (exactTitleCoverageSatisfied) {
        continue;
      }

      let fallbackClassificationKind = "source-backed-no-public-grc-equivalent";
      let fallbackClassificationRationale =
        "The source-backed UW requirement is real, but the current public Green River sources do not prove a planner-ready equivalent path.";
      let fallbackAlternativeCourseCodeSets = [];

      if (
        titleMatchCandidate.exactTitleMatch &&
        exactTitleMatches.length > 1
      ) {
        fallbackClassificationKind = "source-backed-exact-title-multiple-grc-matches";
        fallbackClassificationRationale = `The source-backed UW course title ${titleMatchCandidate.exactTitleMatch.title} matches multiple Green River catalog courses (${exactTitleMatches
          .map((match) => match.code)
          .join(", ")}), so the planner avoids auto-picking a single path.`;
        fallbackAlternativeCourseCodeSets = exactTitleMatches.map((match) => [match.code]);
      } else if (titleMatchCandidate.hasGenericTopicTitle) {
        fallbackClassificationKind = "source-backed-generic-topic-course";
        fallbackClassificationRationale =
          "The source-backed UW requirement row resolves to a generic topics, seminar, or independent-study style title, so the planner keeps it classified but non-promoted.";
      } else if (titleMatchCandidate.hasChoiceLikeTitle) {
        fallbackClassificationKind = "source-backed-choice-set-no-public-grc-path";
        fallbackClassificationRationale =
          "The source-backed UW requirement row is an alternate or choice-based set, but the published Green River sources still do not prove a planner-ready path from that set.";
      } else if (isCampusSpecificUwCourseCode(uwCourseCode)) {
        fallbackClassificationKind = "source-backed-campus-specific-no-public-grc-equivalent";
        fallbackClassificationRationale =
          "The source-backed UW course uses a campus-specific lower-division code, but the current public Green River sources do not prove a matching planner path.";
      }

      classifiedEntries.push(
        buildClassificationEntry({
          owner,
          sourceUwCourseCode: uwCourseCode,
          classificationKind: fallbackClassificationKind,
          displayPhase:
            fallbackPhaseInference.phaseConfidence === "low"
              ? null
              : fallbackPhaseInference.phase,
          phaseConfidence: fallbackPhaseInference.phaseConfidence,
          note: buildClassificationNote(fallbackClassificationKind, uwCourseCode),
          rationale: fallbackClassificationRationale,
          alternativeCourseCodeSets: fallbackAlternativeCourseCodeSets,
          validationNotes: [
            `Automatically classified parsed requirement diff on ${humanDate}.`,
            `Source parse confidence: ${owner.parseConfidence}.`,
            titleMatchCandidate.titleMetadata
              ? `Best parsed title candidate: ${titleMatchCandidate.titleMetadata.title} (${titleMatchCandidate.titleMetadata.source}).`
              : `No clean parsed title candidate was available for ${uwCourseCode}.`,
            titleMatchCandidate.exactTitleMatch
              ? `Exact-title Green River candidates: ${
                  exactTitleMatches.length
                    ? exactTitleMatches.map((match) => `${match.code} (${match.title})`).join(", ")
                    : "none"
                }.`
              : `No exact-title Green River catalog match was available for ${uwCourseCode}.`,
            ...(fallbackPhaseInference.matchedLines.length
              ? [
                  `Requirement cue lines: ${fallbackPhaseInference.matchedLines
                    .slice(0, 3)
                    .join(" | ")}`,
                ]
              : []),
          ],
        })
      );
    }
  }

  const promotedEntryMap = new Map(promotedEntries.map((entry) => [entry.id, entry]));
  const sortedPromotedEntries = [...promotedEntryMap.values()].sort((left, right) =>
    left.id.localeCompare(right.id)
  );
  const classifiedEntryMap = new Map(classifiedEntries.map((entry) => [entry.id, entry]));
  const sortedClassifiedEntries = [...classifiedEntryMap.values()].sort((left, right) =>
    left.id.localeCompare(right.id)
  );
  const classificationSummary = {
    generatedAt,
    totalOwners: parseReport.totalOwners ?? 0,
    promotedCount: sortedPromotedEntries.length,
    classifiedCount: sortedClassifiedEntries.length,
    nonPromotedClassificationCount: sortedClassifiedEntries.filter(
      (entry) => !entry.promotedRequirementAtomOverrideId
    ).length,
    reviewCandidateCount: 0,
    unmappedCount: 0,
    countsByKind: sortedClassifiedEntries.reduce((counts, entry) => {
      counts[entry.classificationKind] = (counts[entry.classificationKind] ?? 0) + 1;
      return counts;
    }, {}),
    countsByCampus: sortedClassifiedEntries.reduce((counts, entry) => {
      counts[entry.campusId] = (counts[entry.campusId] ?? 0) + 1;
      return counts;
    }, {}),
  };

  return {
    generatedAt,
    totalOwners: parseReport.totalOwners ?? 0,
    promotedCount: sortedPromotedEntries.length,
    classifiedCount: sortedClassifiedEntries.length,
    nonPromotedClassificationCount: classificationSummary.nonPromotedClassificationCount,
    reviewCandidateCount: 0,
    unmappedCount: 0,
    promotedEntries: sortedPromotedEntries,
    classifiedEntries: sortedClassifiedEntries,
    reviewCandidates: [],
    unmappedCandidates: [],
    classificationSummary,
  };
}

function main() {
  const parseFirst = hasArg("--parse-first") || !fs.existsSync(PARSE_REPORT_PATH);

  fs.mkdirSync(TMP_DIR, { recursive: true });

  if (parseFirst) {
    runRequirementParse();
  }

  if (!fs.existsSync(PARSE_REPORT_PATH)) {
    throw new Error(
      `Could not find requirement parse report at ${PARSE_REPORT_PATH}. Run planner:parse-requirement-sources first.`
    );
  }

  const parseReport = JSON.parse(fs.readFileSync(PARSE_REPORT_PATH, "utf8"));
  const promotionReport = buildPromotionReport(parseReport);

  fs.writeFileSync(OUTPUT_PATH, buildGeneratedFile(promotionReport.promotedEntries));
  fs.writeFileSync(
    OUTPUT_CLASSIFICATION_PATH,
    buildClassificationGeneratedFile(promotionReport)
  );
  fs.writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(promotionReport, null, 2)}\n`);
  buildReportMarkdown(promotionReport);

  console.log(
    `Auto-promoted ${promotionReport.promotedCount} requirement override(s).`
  );
  console.log(`Automatically classified requirement diffs: ${promotionReport.classifiedCount}`);
  console.log(
    `Non-promoted classified source-backed UW course codes: ${promotionReport.nonPromotedClassificationCount}`
  );
  console.log(`Override file: ${OUTPUT_PATH}`);
  console.log(`Classification file: ${OUTPUT_CLASSIFICATION_PATH}`);
  console.log(`JSON report: ${OUTPUT_JSON_PATH}`);
  console.log(`Markdown report: ${OUTPUT_MD_PATH}`);
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
