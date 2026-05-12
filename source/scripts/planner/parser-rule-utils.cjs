const PARSER_RULE_REGISTRY = [
  {
    id: "option-replacement-group",
    appliesTo: {
      sourceRoles: ["primary-degree-requirements", "department-requirements", "pathway-degree-sheet"],
      pageTypes: ["html-degree-page", "pdf-degree-sheet", "generic-html"],
    },
    detector: {
      cues: [
        "option requirements",
        "except the ... requirement",
        "in place of",
        "core and elective requirements below",
        "may be replaced by",
      ],
    },
    extractor: "extractOptionReplacementAndSectionedCourseGroup",
    confidence: "high-with-source-heading-and-course-section",
  },
  {
    id: "sectioned-course-group",
    appliesTo: {
      sourceRoles: ["primary-degree-requirements", "department-requirements", "pathway-degree-sheet"],
      pageTypes: ["html-degree-page", "pdf-degree-sheet", "generic-html"],
    },
    detector: {
      cues: [
        "selected from the following list",
        "courses listed below",
        "minimum of ... credits",
        "maximum of ... credits",
        "one/two electives",
      ],
    },
    extractor: "extractSectionedCourseRequirementGroup",
    confidence: "high-with-section-heading-and-course-rows",
  },
  {
    id: "credit-bucket",
    appliesTo: {
      sourceRoles: ["primary-degree-requirements", "department-requirements", "official-catalog"],
      pageTypes: ["html-degree-page", "pdf-degree-sheet", "catalog-page", "generic-html"],
    },
    detector: {
      cues: [
        "additional credits from",
        "approved natural science",
        "Math/Science",
        "approved electives",
        "credit range",
      ],
    },
    extractor: "extractCreditBucketPlaceholder",
    confidence: "high-with-credit-range-and-approved-list-cue",
  },
  {
    id: "sequence-or-either-or",
    appliesTo: {
      sourceRoles: ["primary-degree-requirements", "department-requirements", "official-catalog"],
      pageTypes: ["html-degree-page", "pdf-degree-sheet", "catalog-page", "generic-html"],
    },
    detector: {
      cues: ["or", "either", "choose one sequence", "one of the following"],
    },
    extractor: "extractAlternativeCourseOrSequenceGroup",
    confidence: "high-with-explicit-or-or-sequence-cue",
  },
  {
    id: "support-source-filter",
    appliesTo: {
      sourceRoles: [
        "approved-course-list",
        "elective-list",
        "sample-schedule",
        "upper-division-prerequisite-table",
        "non-schedulable-course-list",
      ],
      pageTypes: ["html-degree-page", "pdf-degree-sheet", "generic-html"],
    },
    detector: {
      cues: [
        "approved course list",
        "course list",
        "sample schedule",
        "policy",
        "count toward",
        "support-only",
      ],
    },
    extractor: "filterSupportOnlyCourseEvidence",
    confidence: "high-with-support-role-or-support-only-line-cue",
  },
];

function normalizeWhitespace(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function uniqueInOrder(values) {
  const seen = new Set();
  const output = [];
  for (const value of values ?? []) {
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    output.push(value);
  }
  return output;
}

function escapeRegExp(value) {
  return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getParserRuleRegistry() {
  return PARSER_RULE_REGISTRY.map((rule) => ({
    id: rule.id,
    appliesTo: rule.appliesTo,
    detector: rule.detector,
    extractor: rule.extractor,
    confidence: rule.confidence,
  }));
}

function getParserRule(ruleId) {
  return PARSER_RULE_REGISTRY.find((rule) => rule.id === ruleId) ?? null;
}

function buildRuleEvidence(ruleId, evidenceLines, confidence = "medium") {
  return {
    ruleId,
    confidence,
    evidence: uniqueInOrder((evidenceLines ?? []).map(normalizeWhitespace).filter(Boolean)).slice(0, 5),
  };
}

function getOwnerContextText(input) {
  return [
    input?.ownerTitle,
    input?.sourceLabel,
    input?.primarySourceLabel,
    input?.sourceUrl,
    input?.primarySourceUrl,
    input?.planId,
    input?.ownerId,
  ]
    .filter(Boolean)
    .join(" ");
}

function cleanProgramName(value) {
  return normalizeWhitespace(value)
    .replace(/\b(?:on|from|at|via|website|course|courses|list|requirement|requirements)\b.*$/i, "")
    .replace(/\b(?:degree|major|program)\b$/i, "")
    .replace(/[.;:,]+$/g, "")
    .trim();
}

function getProgramAcronym(programName) {
  const normalized = normalizeWhitespace(programName);
  if (!normalized) {
    return "PROGRAM";
  }

  const tokens = normalized
    .replace(/&/g, " and ")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .filter((token) => !/^(?:and|of|the|for|in|with|science|sciences)$/i.test(token));
  const acronym = tokens.map((token) => token[0]?.toUpperCase()).join("");
  return acronym || normalized.replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase() || "PROGRAM";
}

function extractProgramNameFromBucketText(text, owner = {}) {
  const normalizedText = normalizeWhitespace(text);
  const directPatterns = [
    /\bnatural science courses for\s+([A-Z][A-Za-z&/\s-]{2,80}?)(?:\s+on\b|\s+from\b|\s+website\b|[.;,)]|$)/i,
    /\bapproved\s+([A-Z][A-Za-z&/\s-]{2,80}?)\s+(?:natural science|math\/science|math\s*&\s*science)\b/i,
    /\b([A-Z][A-Za-z&/\s-]{2,80}?)\s+(?:natural science|math\/science|math\s*&\s*science)\s+(?:requirement|courses?|list)\b/i,
  ];

  for (const pattern of directPatterns) {
    const match = normalizedText.match(pattern);
    const programName = cleanProgramName(match?.[1]);
    if (programName && !/^(?:approved|additional|natural|math|mathematics)$/i.test(programName)) {
      return programName;
    }
  }

  const ownerTitle = cleanProgramName(owner.ownerTitle);
  if (
    ownerTitle &&
    new RegExp(`\\b${escapeRegExp(ownerTitle)}\\b`, "i").test(getOwnerContextText(owner))
  ) {
    return ownerTitle;
  }

  return null;
}

function detectProgramApprovedCreditBucket(input) {
  const text = normalizeWhitespace(input?.text);
  if (!text || !/\bapproved\b/i.test(text)) {
    return null;
  }

  const hasNaturalScience = /\bnatural sciences?\b/i.test(text);
  const hasMathScience = /\bmath(?:ematics)?\/science\b|\bmath(?:ematics)?\s*&\s*science\b/i.test(text);
  if (!hasNaturalScience && !hasMathScience) {
    return null;
  }

  const programName = extractProgramNameFromBucketText(text, input?.owner ?? {});
  if (!programName) {
    return null;
  }

  const programSlug = slugify(programName);
  const programAcronym = getProgramAcronym(programName);
  const bucketSlug = hasMathScience ? "math-science" : "natural-science";
  const bucketCategory = hasMathScience ? "MATH_SCIENCE" : "NATURAL_SCIENCE";
  const bucketLabel = hasMathScience ? "Math/Science" : "Natural Science";

  return {
    category: `${programAcronym}_${bucketCategory}`,
    sourceCategoryCode: `${programAcronym} ${bucketLabel}`,
    longLabel: `approved ${programName} ${bucketLabel}`,
    approvedListKey: `${programSlug}-${bucketSlug}`,
    programSpecific: true,
    rule: buildRuleEvidence("credit-bucket", [text], "high"),
  };
}

function shouldJoinCreditBucketContinuation(input) {
  const firstLine = normalizeWhitespace(input?.firstLine);
  if (!firstLine) {
    return false;
  }

  return /\b(?:list of approved|approved|math\/science|math\s*&\s*science|natural science courses for)\b/i.test(
    firstLine
  );
}

function isCreditBucketContinuationLine(line) {
  const normalizedLine = normalizeWhitespace(line);
  if (!normalizedLine) {
    return false;
  }
  if (/^\[Page\s+\d+\]/i.test(normalizedLine)) {
    return true;
  }
  if (/^[a-z(]/.test(normalizedLine)) {
    return true;
  }
  return /\b(?:approved|natural science|Math\/Science|Math\s*&\s*Science|Computer Engineering|CSE website|website|STAT|MATH|AMATH)\b/i.test(
    normalizedLine
  );
}

function hasSupportOnlyLineCue(line) {
  const normalizedLine = normalizeWhitespace(line);
  if (!normalizedLine) {
    return false;
  }
  if (
    /\b(?:as well as|which can include|can include|up to)\b.{0,140}\bcount(?:s|ed)?\s+(?:toward|required(?:\s+for\s+graduation)?)\b/i.test(
      normalizedLine
    ) ||
    /\bcount(?:s|ed)?\s+(?:toward|required(?:\s+for\s+graduation)?)\b.{0,140}\b(?:natural sciences?|additional coursework|elective credits?|requirements?)\b/i.test(
      normalizedLine
    )
  ) {
    return true;
  }
  if (
    /\b(?:one\s+course\s+chosen\s+from|one\s+course\s+from|choose|select|required)\b/i.test(
      normalizedLine
    )
  ) {
    return false;
  }

  return (
    /\b(?:approved\s+)?(?:courses?|course|core|capstone|electives?|systems electives?)\s+list\b/i.test(
      normalizedLine
    ) ||
    /\blist\s+on\s+the\b/i.test(normalizedLine) ||
    /\b(?:as well as|which can include|can include|up to)\b.{0,120}\bcount(?:s|ed)?\s+toward\b/i.test(
      normalizedLine
    ) ||
    /\bcount(?:s|ed)?\s+toward\b.{0,120}\b(?:natural sciences?|additional coursework|elective credits?|requirements?)\b/i.test(
      normalizedLine
    )
  );
}

function hasOptionReplacementRequirementCue(line) {
  const normalizedLine = normalizeWhitespace(line);
  if (!normalizedLine) {
    return false;
  }

  return (
    /\b(?:in place of|instead of|may be replaced by|replace(?:s|d)?|substitut(?:e|es|ed))\b.{0,140}\brequirements?\b/i.test(
      normalizedLine
    ) ||
    /\brequirements?\b.{0,140}\b(?:in place of|instead of|may be replaced by|replace(?:s|d)?|substitut(?:e|es|ed))\b/i.test(
      normalizedLine
    ) ||
    /\bcore\s+(?:and|&)\s+elective\s+requirements?\b/i.test(normalizedLine) ||
    /\belectives?\s*\([^)]*\b\d+\s+credits?\s+required\b/i.test(normalizedLine) ||
    /\btechnical electives?\s+requirements?\b/i.test(
      normalizedLine
    )
  );
}

function filterCourseCodesBySupportOnlyEvidence(input) {
  const courseCodes = uniqueInOrder(input?.courseCodes ?? []);
  const getSourceLineHints = input?.getSourceLineHints;
  if (typeof getSourceLineHints !== "function") {
    return courseCodes;
  }

  return courseCodes.filter((courseCode) => {
    const hints = getSourceLineHints(courseCode);
    if (!hints.length) {
      return true;
    }

    return hints.some((hint) => !hasSupportOnlyLineCue(hint));
  });
}

function extractOptionAcronymFromText(text) {
  const normalizedText = normalizeWhitespace(text);
  const match = normalizedText.match(/\b([A-Z][A-Z0-9&]{1,8})\s+Option\b/);
  return match?.[1] ?? null;
}

function normalizeRequirementSlug(label) {
  const normalized = normalizeWhitespace(label)
    .replace(/\b\d+\s*credits?\b/gi, "")
    .replace(/\brequirements?\b/gi, "")
    .replace(/\bthe\b/gi, "")
    .replace(/\band\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return slugify(
    normalized
      .replace(/\btechnical elective\b/i, "technical electives")
      .replace(/\bcore elective\b/i, "core elective")
  );
}

function buildRequirementGroupIdFromReplacement(owner, label, credits, options = {}) {
  const ownerId = owner?.ownerId || owner?.planId || "unknown-owner";
  const ownerPrefix = options.ownerPrefix ? `${slugify(options.ownerPrefix)}-` : "";
  const labelSlug = normalizeRequirementSlug(label);
  const creditSlug = Number.isFinite(credits) ? `${credits}-credits` : "credits";
  return `${ownerId}:requirement-group:${ownerPrefix}${labelSlug}-${creditSlug}`;
}

function detectOptionReplacement(input) {
  const owner = input?.owner ?? {};
  const lines = (input?.snapshotLines ?? []).map(normalizeWhitespace).filter(Boolean);
  const contextText = getOwnerContextText(owner);
  const combined = lines.join(" ");
  const optionAcronym =
    extractOptionAcronymFromText(`${contextText} ${combined}`) ??
    extractOptionAcronymFromText(combined);

  if (!optionAcronym) {
    return null;
  }

  const ownerLooksLikeOption =
    new RegExp(`\\b${escapeRegExp(optionAcronym)}\\b`, "i").test(contextText);
  if (!ownerLooksLikeOption) {
    return null;
  }

  const replacementLine = lines.find(
    (line) =>
      /\bexcept\b.{0,120}\brequirement\b/i.test(line) &&
      /\bin place of\b/i.test(line) &&
      /\bcomplete\b/i.test(line)
  );
  if (!replacementLine) {
    return null;
  }

  const baseMatch = replacementLine.match(
    /\bexcept\s+the\s+(\d+)\s+credits?\s+(.+?)\s+requirement\b/i
  );
  const replacementMatch = replacementLine.match(
    /\bcomplete\s+(?:a\s+|the\s+)?(\d+)\s+credits?\s+(.+?)(?:\s+below|[.;]|$)/i
  );
  if (!baseMatch || !replacementMatch) {
    return null;
  }

  const baseCredits = Number.parseFloat(baseMatch[1]);
  const replacementCredits = Number.parseFloat(replacementMatch[1]);
  if (!Number.isFinite(baseCredits) || !Number.isFinite(replacementCredits)) {
    return null;
  }

  const explicitOwnerPrefix =
    replacementLine.match(/\ball\s+([A-Z]{2,8})\s+degree requirements\b/i)?.[1] ??
    combined.match(new RegExp(`\\b([A-Z]{2,8})\\s+${escapeRegExp(optionAcronym)}\\s+requirements\\b`, "i"))?.[1] ??
    null;
  const ownerPrefix = (explicitOwnerPrefix ?? getProgramAcronym(owner.ownerTitle ?? owner.planId ?? "")).toLowerCase();
  const baseLabel = baseMatch[2];
  const replacementLabel = replacementMatch[2];
  const sourceHeading =
    lines.find((line) => new RegExp(`\\b${escapeRegExp(optionAcronym)}\\b.*\\brequirements?\\b`, "i").test(line)) ||
    `${optionAcronym} Option requirements`;
  const replacementReason = `${optionAcronym} Option students complete ${replacementCredits} credits of ${normalizeWhitespace(
    replacementLabel
  )} instead of the standard ${baseCredits}-credit ${normalizeWhitespace(baseLabel)} requirement.`;

  return {
    baseRequirementId: buildRequirementGroupIdFromReplacement(owner, baseLabel, baseCredits, {
      ownerPrefix,
    }),
    replacedByRequirementId: buildRequirementGroupIdFromReplacement(
      owner,
      replacementLabel,
      replacementCredits,
      { ownerPrefix }
    ),
    appliesWhen: `selectedOption === "${optionAcronym}"`,
    replacementReason,
    sourceUrl: input?.sourceUrl ?? null,
    sourceHeading,
    optionAcronym,
    replacementCredits,
    baseCredits,
    rule: buildRuleEvidence("option-replacement-group", [sourceHeading, replacementLine], "high"),
  };
}

module.exports = {
  buildRuleEvidence,
  detectOptionReplacement,
  detectProgramApprovedCreditBucket,
  filterCourseCodesBySupportOnlyEvidence,
  getParserRule,
  getParserRuleRegistry,
  hasOptionReplacementRequirementCue,
  hasSupportOnlyLineCue,
  isCreditBucketContinuationLine,
  shouldJoinCreditBucketContinuation,
  slugify,
};
