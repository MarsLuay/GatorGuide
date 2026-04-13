import type {
  TransferPlannerMajorPathway,
  TransferPlannerMajorPlan,
} from "../transfer-planner-types";
import type { TransferPlannerParsedRequirementSourceBlock } from "./schema";

const PATHWAY_FAMILY_MEMBER_PATTERNS = [
  /\bfamily currently includes\s+([^.]*)/i,
  /\bcurrent\b[^.]*\boptions?\s+in\s+([^.]*)/i,
  /\boption(?:-area)? finishes?\s+in\s+([^.]*)/i,
  /\bone of the\b[^.]*\boptions?\s+in\s+([^.]*)/i,
] as const;
const SYNTHETIC_PATHWAY_KEYWORD_PATTERN = /\b(option|track|route|pathway|concentration)\b/i;
const SYNTHETIC_GENERAL_PATHWAY_PATTERN = /^general\b/i;
const SYNTHETIC_GENERIC_LABELS = new Set([
  "choose your pathway",
  "concentration courses",
  "option courses",
  "requirements to declare the option",
  "requirements to declare the option or the concentration",
]);
const SYNTHETIC_ROUTE_LABEL_PATTERNS = [
  /^the\s+(.+?)(?:\s+is\b.*)?$/i,
  /^students in the\s+(.+?)(?:\s+must\b.*)?$/i,
  /^students who complete the\s+(.+?)(?:\s+will\b.*)?$/i,
  /^download the requirements(?: and courses lists)?(?: from)?(?: for)? the\s+(.+?)(?::)?$/i,
  /^declaring the\s+(.+?)(?::)?$/i,
] as const;
const SYNTHETIC_DISALLOWED_CANDIDATE_PATTERN =
  /\b(courses?|coursework|faculty|advisor|adviser|requirements?|declare|declaration|graduation|application|students?|colloquium|culminating|internship|credit(?:s)?|school approval)\b/i;

function decodePlannerText(value: string) {
  return String(value ?? "").replace(/&(#\d+|amp|nbsp);/gi, (match, entity) => {
    const normalizedEntity = String(entity ?? "").toLowerCase();
    if (normalizedEntity === "amp") return "&";
    if (normalizedEntity === "nbsp") return " ";

    if (normalizedEntity.startsWith("#")) {
      const codePoint = Number(normalizedEntity.slice(1));
      if (Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff) {
        return String.fromCodePoint(codePoint);
      }
    }

    return match;
  });
}

function normalizePlannerSpaces(value: string) {
  return decodePlannerText(value).replace(/\s+/g, " ").trim();
}

function uniquePlannerStrings(values: string[]) {
  const seen = new Set<string>();
  const uniqueValues: string[] = [];

  for (const value of values) {
    const normalized = normalizePlannerSpaces(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    uniqueValues.push(normalized);
  }

  return uniqueValues;
}

function uniquePlannerLabelsByCanonical(values: string[]) {
  const seen = new Set<string>();
  const uniqueValues: string[] = [];

  for (const value of values) {
    const normalizedValue = normalizePlannerSpaces(value);
    const canonicalValue = normalizedValue
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!normalizedValue || !canonicalValue || seen.has(canonicalValue)) continue;
    seen.add(canonicalValue);
    uniqueValues.push(normalizedValue);
  }

  return uniqueValues;
}

function normalizePathwayFamilyMemberLabel(value: string) {
  return normalizePlannerSpaces(value)
    .replace(/\.$/, "")
    .replace(/^(?:and|or)\s+/i, "")
    .trim();
}

function isLikelyPathwayFamilyMemberLabel(value: string) {
  const normalizedValue = normalizePathwayFamilyMemberLabel(value);
  if (!normalizedValue) return false;
  if (/^[a-z]/.test(normalizedValue)) return false;
  if (normalizedValue.split(" ").length > 10) return false;
  if (
    /\b(supporting-science|required courses?|electives?|credits?|package|packages|upper-division)\b/i.test(
      normalizedValue
    )
  ) {
    return false;
  }
  return true;
}

function splitPathwayFamilyMemberList(rawValue: string) {
  const normalizedRaw = normalizePlannerSpaces(rawValue).replace(/,\s*each\b.*$/i, "").trim();
  if (!normalizedRaw) return [] as string[];

  const rawMembers = normalizedRaw.includes(";")
    ? normalizedRaw.split(";")
    : normalizedRaw
        .replace(/\s*,\s*and\s+/gi, ", ")
        .replace(/\s*,\s*or\s+/gi, ", ")
        .replace(/\s+and\s+/gi, ", ")
        .replace(/\s+or\s+/gi, ", ")
        .split(",");

  return uniquePlannerStrings(
    rawMembers
      .map(normalizePathwayFamilyMemberLabel)
      .filter(isLikelyPathwayFamilyMemberLabel)
  );
}

function extractPathwayFamilyMembersFromText(text: string) {
  const normalizedText = normalizePlannerSpaces(text);
  if (!normalizedText) return [] as string[];

  for (const pattern of PATHWAY_FAMILY_MEMBER_PATTERNS) {
    const match = normalizedText.match(pattern);
    if (!match) continue;

    const members = splitPathwayFamilyMemberList(match[1] ?? "");
    if (members.length > 1) {
      return members;
    }
  }

  return [] as string[];
}

function getExpandedPathwayFamilyMembers(pathway: TransferPlannerMajorPathway) {
  if (!/\bfamily\b/i.test(pathway.label)) {
    return [] as string[];
  }

  const candidateTexts = uniquePlannerStrings([
    pathway.label,
    pathway.summary,
    pathway.plannerNote ?? "",
    pathway.grcCourseListGuidance ?? "",
    ...(pathway.degreeMapSections ?? []).flatMap((section) => [
      section.title,
      section.note ?? "",
      ...section.items,
    ]),
    ...(pathway.manualReviewNotes ?? []),
  ]);

  for (const candidateText of candidateTexts) {
    const members = extractPathwayFamilyMembersFromText(candidateText);
    if (members.length > 1) {
      return members;
    }
  }

  return [] as string[];
}

function slugifyPathwayLabel(value: string) {
  return normalizePlannerSpaces(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildExpandedPathwayFamilyLabel(pathwayLabel: string, memberLabel: string) {
  const normalizedLabel = normalizePlannerSpaces(pathwayLabel);
  if (!normalizedLabel) return memberLabel;

  if (/\boption family\b/i.test(normalizedLabel)) {
    return normalizedLabel.replace(/\boption family\b/i, `${memberLabel} option`);
  }

  if (/\btrack family\b/i.test(normalizedLabel)) {
    return normalizedLabel.replace(/\btrack family\b/i, `${memberLabel} track`);
  }

  if (/\broute family\b/i.test(normalizedLabel)) {
    return normalizedLabel.replace(/\broute family\b/i, `${memberLabel} route`);
  }

  return `${normalizedLabel}: ${memberLabel}`;
}

function buildExpandedPathwayFamilySummary(
  pathway: TransferPlannerMajorPathway,
  memberLabel: string
) {
  const normalizedSummary = normalizePlannerSpaces(pathway.summary);
  if (!normalizedSummary) return "";

  return `Specific ${memberLabel} route. ${normalizedSummary}`;
}

export function expandPlannerPathwayFamilyMembers(
  pathway: TransferPlannerMajorPathway
): TransferPlannerMajorPathway[] {
  const familyMembers = getExpandedPathwayFamilyMembers(pathway);
  if (familyMembers.length < 2) {
    return [pathway];
  }

  return familyMembers.map<TransferPlannerMajorPathway>((memberLabel) => ({
    ...pathway,
    id: `${pathway.id}:${slugifyPathwayLabel(memberLabel)}`,
    label: buildExpandedPathwayFamilyLabel(pathway.label, memberLabel),
    summary: buildExpandedPathwayFamilySummary(pathway, memberLabel),
  }));
}

function getPlanSupportTokens(title: string) {
  return normalizePlannerSpaces(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(
      (token) =>
        token.length >= 4 &&
        !["major", "studies", "science", "arts", "bachelor"].includes(token)
    );
}

function getPlanSpecializationTokens(title: string) {
  const normalizedTitle = normalizePlannerSpaces(title);
  const colonIndex = normalizedTitle.indexOf(":");
  const commaIndex = normalizedTitle.indexOf(",");
  const specializationText =
    colonIndex >= 0
      ? normalizedTitle.slice(colonIndex + 1)
      : commaIndex >= 0
        ? normalizedTitle.slice(0, commaIndex)
        : "";
  if (!specializationText) {
    return [] as string[];
  }

  const tokens = specializationText
    .replace(/\([^)]*\)/g, " ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(
      (token) =>
        token.length >= 4 &&
        ![
          "option",
          "track",
          "route",
          "major",
          "management",
          "administration",
          "business",
          "education",
        ].includes(token)
    );

  if (colonIndex === -1 && tokens.length !== 1) {
    return [] as string[];
  }

  return tokens;
}

function getSpecializationTokenVariants(token: string) {
  const normalizedToken = normalizePlannerSpaces(token).toLowerCase();
  if (!normalizedToken) return [] as string[];
  if (normalizedToken === "voice") {
    return ["voice", "vocal"];
  }
  if (normalizedToken === "vocal") {
    return ["vocal", "voice"];
  }
  return [normalizedToken];
}

function syntheticLabelMatchesSpecialization(label: string, specializationTokens: string[]) {
  const normalizedLabel = normalizeSyntheticPathwayLabel(label).toLowerCase();
  return specializationTokens.some((token) =>
    getSpecializationTokenVariants(token).some((variant) => normalizedLabel.includes(variant))
  );
}

function normalizeSyntheticPathwayLabel(value: string) {
  return normalizePlannerSpaces(value)
    .replace(/\|.*$/, "")
    .replace(/\s+-\s*School of.*$/i, "")
    .replace(/\s+\[[^\]]+\]$/i, "")
    .replace(/\(PDF\)$/i, "")
    .replace(/[.:]+$/, "")
    .trim();
}

function extractSyntheticPathwayListMembers(value: string) {
  const normalizedValue = normalizeSyntheticPathwayLabel(value);
  const colonIndex = normalizedValue.indexOf(":");
  if (colonIndex === -1) {
    return [] as string[];
  }

  const tail = normalizedValue.slice(colonIndex + 1).trim();
  if (!tail || tail.split(/\s+/).length > 18) {
    return [] as string[];
  }

  return uniquePlannerStrings(
    tail
      .replace(/\band\b/gi, ",")
      .replace(/\bor\b/gi, ",")
      .split(",")
      .map((entry) => entry.trim())
  );
}

function extractSyntheticLeadingPathwayLabel(value: string) {
  const normalizedValue = normalizeSyntheticPathwayLabel(value);

  for (const pattern of SYNTHETIC_ROUTE_LABEL_PATTERNS) {
    const match = normalizedValue.match(pattern);
    if (!match?.[1]) continue;
    return normalizeSyntheticPathwayLabel(match[1]);
  }

  return normalizedValue;
}

function isLikelySyntheticPathwayLabel(label: string, planTitle: string) {
  const normalizedLabel = normalizeSyntheticPathwayLabel(label);
  if (!normalizedLabel) return false;
  if (
    normalizedLabel.split(/\s+/).length > 10 ||
    (!SYNTHETIC_PATHWAY_KEYWORD_PATTERN.test(normalizedLabel) &&
      !SYNTHETIC_GENERAL_PATHWAY_PATTERN.test(normalizedLabel))
  ) {
    return false;
  }
  if (
    /^option\s+(?:\d+|one|two|three|four)$/i.test(normalizedLabel) ||
    SYNTHETIC_GENERIC_LABELS.has(normalizedLabel.toLowerCase())
  ) {
    return false;
  }
  if (normalizedLabel.split(/\s+/).length < 2 && !SYNTHETIC_GENERAL_PATHWAY_PATTERN.test(normalizedLabel)) {
    return false;
  }
  if (SYNTHETIC_DISALLOWED_CANDIDATE_PATTERN.test(normalizedLabel)) {
    return false;
  }
  if (/^(?:B\.?\s*[AB]\.?|Bachelor of)\b/i.test(normalizedLabel)) {
    const supportTokens = getPlanSupportTokens(planTitle);
    const normalizedLower = normalizedLabel.toLowerCase();
    if (supportTokens.length && !supportTokens.some((token) => normalizedLower.includes(token))) {
      return false;
    }
  }
  return true;
}

function buildSyntheticPathwaySupportTexts(plan: TransferPlannerMajorPlan) {
  return uniquePlannerStrings([
    plan.summary,
    plan.plannerNote ?? "",
    ...(plan.whyThisTrack ?? []),
    ...(plan.advisorFlags ?? []),
    ...(plan.manualReviewNotes ?? []),
    ...(plan.degreeMapSections ?? []).flatMap((section) => [
      section.title,
      section.note ?? "",
      ...section.items,
    ]),
  ]).map((value) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function buildSyntheticPathwaySupportKeys(label: string) {
  const normalizedLabel = normalizeSyntheticPathwayLabel(label)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const baseLabel = normalizedLabel
    .replace(/\b(option|track|route|pathway|concentration|major)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return uniquePlannerStrings([normalizedLabel, baseLabel]).filter((value) => value.length >= 4);
}

function isSyntheticPathwaySupportedByPlan(
  label: string,
  supportTexts: string[]
) {
  const keys = buildSyntheticPathwaySupportKeys(label);
  return keys.some((key) => supportTexts.some((text) => text.includes(key)));
}

function buildSyntheticPathwaySummary(label: string) {
  if (SYNTHETIC_GENERAL_PATHWAY_PATTERN.test(label)) {
    return "Source-backed general route surfaced from the current official requirements for this major.";
  }

  if (/\bconcentration\b/i.test(label)) {
    return "Source-backed concentration surfaced from the current official requirements for this major.";
  }

  if (/\boption\b/i.test(label)) {
    return "Source-backed option surfaced from the current official requirements for this major.";
  }

  if (/\btrack\b/i.test(label)) {
    return "Source-backed track surfaced from the current official requirements for this major.";
  }

  return "Source-backed route surfaced from the current official requirements for this major.";
}

function collectSynthesizedPathwayLabels(
  plan: TransferPlannerMajorPlan,
  parsedSourceBlocks: TransferPlannerParsedRequirementSourceBlock[]
) {
  const supportTexts = buildSyntheticPathwaySupportTexts(plan);
  const specializationTokens = getPlanSpecializationTokens(plan.title);
  const sourceLabels = uniquePlannerStrings(
    parsedSourceBlocks.flatMap((block) => block.pathwayLabels ?? [])
  );
  const extractedLabels = uniquePlannerLabelsByCanonical(
    sourceLabels.flatMap((rawLabel) =>
      uniquePlannerLabelsByCanonical([
        extractSyntheticLeadingPathwayLabel(rawLabel),
        ...extractSyntheticPathwayListMembers(rawLabel),
      ]).filter((candidate) => isLikelySyntheticPathwayLabel(candidate, plan.title))
    )
  );

  const supportedLabels = extractedLabels.filter((label) =>
    isSyntheticPathwaySupportedByPlan(label, supportTexts)
  );
  const generalLabels = extractedLabels.filter((label) =>
    SYNTHETIC_GENERAL_PATHWAY_PATTERN.test(label)
  );
  const orderedLabels = uniquePlannerLabelsByCanonical([
    ...generalLabels,
    ...supportedLabels,
  ]);
  const narrowedLabels = specializationTokens.length
    ? orderedLabels.filter((label) => {
        if (SYNTHETIC_GENERAL_PATHWAY_PATTERN.test(label)) {
          return false;
        }

        return syntheticLabelMatchesSpecialization(label, specializationTokens);
      })
    : orderedLabels;

  return narrowedLabels.length >= 2 ? narrowedLabels : [] as string[];
}

function buildSynthesizedPathway(label: string): TransferPlannerMajorPathway {
  return {
    id: `source-pathway-${slugifyPathwayLabel(label)}`,
    label,
    summary: buildSyntheticPathwaySummary(label),
  };
}

export function materializeTransferPlannerPathways(
  plan: TransferPlannerMajorPlan,
  basePathways: TransferPlannerMajorPathway[],
  parsedSourceBlocks: TransferPlannerParsedRequirementSourceBlock[]
): TransferPlannerMajorPathway[] {
  if (basePathways.length) {
    return basePathways.flatMap(expandPlannerPathwayFamilyMembers);
  }

  return collectSynthesizedPathwayLabels(plan, parsedSourceBlocks).map(buildSynthesizedPathway);
}

export function countMaterializedTransferPlannerPathways(
  plan: TransferPlannerMajorPlan,
  basePathways: TransferPlannerMajorPathway[],
  parsedSourceBlocks: TransferPlannerParsedRequirementSourceBlock[]
): number {
  return materializeTransferPlannerPathways(plan, basePathways, parsedSourceBlocks).length;
}
