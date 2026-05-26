#!/usr/bin/env node

const path = require("path");
const {
  SOURCE_ROOT,
  getArgValue,
  getPlannerTmpPath,
  hasArg,
  writePlannerJsonReport,
  writePlannerMarkdownReport,
} = require("./lib/script-harness.cjs");

process.env.TS_NODE_TRANSPILE_ONLY = "true";
process.env.TS_NODE_BASEURL = process.env.TS_NODE_BASEURL || ".";
process.env.TS_NODE_COMPILER_OPTIONS =
  process.env.TS_NODE_COMPILER_OPTIONS ||
  JSON.stringify({
    module: "Node16",
    moduleResolution: "node16",
    baseUrl: ".",
    paths: {
      "@/*": ["./*"],
    },
  });

require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

const {
  TRANSFER_PLANNER_CAMPUSES,
  TRANSFER_PLANNER_TRACKS,
  extractTransferPlannerCourseCodes,
  getTransferPlannerCanonicalCourse,
  getTransferPlannerGrcCourseList,
  getTransferPlannerParsedRequirementSourceBlocks,
  getTransferPlannerPrimaryDegreeRequirementsSource,
  getTransferPlannerStudentRuntimeMajorsForCampus,
  getTransferPlannerStudentRuntimePathwaysForPlan,
  resolveTransferPlannerStudentRuntimeMajorPlan,
} = require("../../constants/transfer-planner-source/student-runtime");

const DEFAULT_BASENAME = "transfer-planner-ai-fact-check-export";
const DEFAULT_MD_PATH = getPlannerTmpPath(`${DEFAULT_BASENAME}.md`);
const DEFAULT_JSON_PATH = getPlannerTmpPath(`${DEFAULT_BASENAME}.json`);
const MAX_MARKDOWN_CUE_LINES_PER_BLOCK = 40;

function normalizeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueStrings(values) {
  const seen = new Set();
  const result = [];
  for (const value of asArray(values)) {
    const normalized = normalizeText(value);
    if (!normalized) continue;
    const key = normalized.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

function formatMaybeList(values) {
  const normalizedValues = uniqueStrings(values);
  return normalizedValues.length ? normalizedValues.join(", ") : "none";
}

function normalizeDisplayPath(filePath) {
  return path.relative(SOURCE_ROOT, filePath).split(path.sep).join("/");
}

function clipText(value, maxLength = 500) {
  const normalized = normalizeText(value);
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3).trim()}...`;
}

function extractCodesFromLabels(labels) {
  return uniqueStrings(
    asArray(labels).flatMap((label) => extractTransferPlannerCourseCodes(String(label ?? "")))
  );
}

function getCreditText(value) {
  const explicitCreditText = normalizeText(value?.creditText);
  if (explicitCreditText) return explicitCreditText;
  const min = value?.creditMin ?? value?.credits ?? value?.minCredits ?? null;
  const max = value?.creditMax ?? value?.maxCredits ?? null;
  if (min == null && max == null) return null;
  if (max != null && min != null && max !== min) return `${min}-${max} credits`;
  const creditValue = min ?? max;
  return `${creditValue} ${creditValue === 1 ? "credit" : "credits"}`;
}

function createCourseIndex() {
  const courses = new Map();

  function add(schoolId, rawCode, context) {
    const code = normalizeText(rawCode).toUpperCase();
    if (!schoolId || !code) return;

    const key = `${schoolId}|${code}`;
    const existing = courses.get(key);
    const canonical = getTransferPlannerCanonicalCourse(schoolId, code) ?? null;
    const nextContext = normalizeText(context);

    if (existing) {
      if (nextContext && !existing.referencedBy.includes(nextContext)) {
        existing.referencedBy.push(nextContext);
      }
      return;
    }

    courses.set(key, {
      schoolId,
      code,
      title: canonical?.title ?? null,
      credits: canonical?.creditLabel ?? canonical?.creditValue ?? null,
      latestAvailabilitySummary: canonical?.latestAvailabilitySummary ?? null,
      referencedBy: nextContext ? [nextContext] : [],
    });
  }

  function toArray() {
    return [...courses.values()].sort((left, right) =>
      `${left.schoolId}:${left.code}`.localeCompare(`${right.schoolId}:${right.code}`)
    );
  }

  return { add, toArray };
}

function addLink(linksByKey, link) {
  const url = normalizeText(link?.url);
  const label = normalizeText(link?.label) || normalizeText(link?.sourceLabel) || url;
  if (!url) return;

  const key = `${url}|${label}`;
  if (linksByKey.has(key)) return;

  linksByKey.set(key, {
    label,
    url,
    role: normalizeText(link?.role || link?.sourceRole) || null,
    confidence: normalizeText(link?.confidence || link?.sourceConfidence) || null,
    note: normalizeText(link?.note || link?.reason) || null,
  });
}

function summarizeLinks(plan, pathway, primarySource, parsedBlocks) {
  const linksByKey = new Map();
  for (const link of asArray(plan?.officialLinks)) addLink(linksByKey, link);
  for (const link of asArray(pathway?.officialLinks)) addLink(linksByKey, link);
  if (primarySource) addLink(linksByKey, primarySource);

  for (const block of parsedBlocks) {
    addLink(linksByKey, {
      label: block.sourceLabel || block.primarySourceLabel,
      url: block.sourceUrl || block.primarySourceUrl,
      role: block.sourceRole,
    });
    for (const url of asArray(block.coveredSourceUrls)) {
      addLink(linksByKey, {
        label: block.sourceLabel || block.primarySourceLabel || url,
        url,
        role: block.sourceRole,
      });
    }
  }

  return [...linksByKey.values()].sort((left, right) =>
    `${left.label} ${left.url}`.localeCompare(`${right.label} ${right.url}`)
  );
}

function summarizeChecklistItem(item, sectionKey, planContext, courseIndex, campusId) {
  const grcCourseCodes = extractCodesFromLabels([
    ...asArray(item.grcCourses),
    ...asArray(item.alternatives).flat(),
  ]);
  for (const code of grcCourseCodes) {
    courseIndex.add("grc", code, `${planContext} / ${sectionKey} / ${item.title}`);
  }

  return {
    id: normalizeText(item.id),
    title: normalizeText(item.title),
    sourceUrl: normalizeText(item.sourceUrl) || null,
    sourceRole: normalizeText(item.sourceRole) || null,
    sourceSection: normalizeText(item.sourceSection) || null,
    requirementShape: normalizeText(item.requirementShape) || null,
    minCompletedCount: item.minCompletedCount ?? null,
    credits: getCreditText(item),
    grcCourses: uniqueStrings(asArray(item.grcCourses)),
    alternatives: asArray(item.alternatives)
      .map((alternative) => uniqueStrings(alternative))
      .filter((alternative) => alternative.length),
    grcCourseCodes,
    note: normalizeText(item.note) || normalizeText(item.reason) || null,
    generatedFromParser: item.generatedFromParser === true,
    manualOverride: item.manualOverride === true,
  };
}

function summarizeChecklist(items, sectionKey, planContext, courseIndex, campusId) {
  return asArray(items).map((item) =>
    summarizeChecklistItem(item, sectionKey, planContext, courseIndex, campusId)
  );
}

function summarizeRequirementOption(option, planContext, groupLabel, courseIndex, campusId) {
  const uwCourseCodes = uniqueStrings([
    ...extractCodesFromLabels(option.uwCourses),
    ...extractCodesFromLabels(option.equivalentUwCourseCodes),
    ...extractCodesFromLabels(option.displayCourseCodes),
    ...extractCodesFromLabels(option.conditionalLabCourses),
    ...extractCodesFromLabels(option.categoryOption?.approvedUwEquivalentCodes),
    ...extractCodesFromLabels([option.label, option.title, option.pathLabel]),
  ]);
  const grcCourseCodes = extractCodesFromLabels([
    ...asArray(option.grcMatches),
    ...asArray(option.compoundComponents).flat(),
  ]);

  for (const code of uwCourseCodes) {
    courseIndex.add(campusId, code, `${planContext} / ${groupLabel} / ${option.label}`);
  }
  for (const code of grcCourseCodes) {
    courseIndex.add("grc", code, `${planContext} / ${groupLabel} / ${option.label}`);
  }

  return {
    id: normalizeText(option.id) || null,
    label: normalizeText(option.label),
    title: normalizeText(option.title) || null,
    optionKind: normalizeText(option.optionKind) || null,
    requirementShape: normalizeText(option.requirementShape) || null,
    sequencePathId: normalizeText(option.sequencePathId) || null,
    pathLabel: normalizeText(option.pathLabel) || null,
    credits: getCreditText(option),
    uwCourses: uniqueStrings(asArray(option.uwCourses)),
    equivalentUwCourseCodes: uniqueStrings(asArray(option.equivalentUwCourseCodes)),
    displayCourseCodes: uniqueStrings(asArray(option.displayCourseCodes)),
    grcMatches: uniqueStrings(asArray(option.grcMatches)),
    uwCourseCodes,
    grcCourseCodes,
    categoryOption: option.categoryOption
      ? {
          title: normalizeText(option.categoryOption.title),
          category: normalizeText(option.categoryOption.category),
          credits: getCreditText(option.categoryOption),
          sourceText: normalizeText(option.categoryOption.sourceText) || null,
          approvedUwEquivalentCodes: uniqueStrings(option.categoryOption.approvedUwEquivalentCodes),
          programApprovedFilterKeys: uniqueStrings(option.categoryOption.programApprovedFilterKeys),
        }
      : null,
    constraints: uniqueStrings(option.constraints),
    notes: uniqueStrings(option.notes),
    equivalencyEvidence: asArray(option.equivalencyEvidence).map((entry) => ({
      grcSourceCourse: normalizeText(entry.grcSourceCourse),
      uwTargetCourse: normalizeText(entry.uwTargetCourse),
      ruleId: normalizeText(entry.ruleId),
      sourceUrl: normalizeText(entry.sourceUrl) || null,
      effectiveDateLabel: normalizeText(entry.effectiveDateLabel) || null,
      warnings: uniqueStrings(entry.warnings),
      restrictions: uniqueStrings(entry.restrictions),
    })),
  };
}

function summarizeRequirementGroup(group, planContext, courseIndex, campusId) {
  const groupLabel = normalizeText(group.label) || normalizeText(group.id);
  const options = asArray(group.options).map((option) =>
    summarizeRequirementOption(option, planContext, groupLabel, courseIndex, campusId)
  );

  return {
    id: normalizeText(group.id),
    label: groupLabel,
    category: normalizeText(group.category) || null,
    subcategory: normalizeText(group.subcategory) || null,
    requirementType: normalizeText(group.requirementType) || null,
    requirementShape: normalizeText(group.requirementShape) || null,
    satisfactionMode: normalizeText(group.satisfactionMode) || null,
    selectionCount: group.selectionCount ?? null,
    requiredCount: group.requiredCount ?? null,
    minCourses: group.minCourses ?? null,
    maxCourses: group.maxCourses ?? null,
    credits: getCreditText(group),
    sourceUrl: normalizeText(group.sourceUrl) || null,
    sourceHeading: normalizeText(group.sourceHeading) || null,
    sourceSection: normalizeText(group.sourceSection) || null,
    sourceRowText: normalizeText(group.sourceRowText) || null,
    sourceRole: normalizeText(group.sourceRole) || null,
    pathwayId: normalizeText(group.pathwayId) || null,
    approvedListKey: normalizeText(group.approvedListKey) || null,
    canCreateScheduleRow: group.canCreateScheduleRow ?? null,
    canCreatePlaceholder: group.canCreatePlaceholder ?? null,
    supportOnly: group.supportOnly === true,
    programSpecific: group.programSpecific === true,
    notes: uniqueStrings(group.notes),
    sequencePaths: asArray(group.sequencePaths).map((sequencePath) => ({
      id: normalizeText(sequencePath.id),
      label: normalizeText(sequencePath.label),
      uwCourses: uniqueStrings(sequencePath.uwCourses),
      mappedGrcCourseCodes: uniqueStrings(sequencePath.mappedGrcCourseCodes),
      displayCourseCodes: uniqueStrings(sequencePath.displayCourseCodes),
      notes: uniqueStrings(sequencePath.notes),
      sourceText: normalizeText(sequencePath.sourceText) || null,
    })),
    options,
  };
}

function summarizeSupportList(list) {
  return {
    id: normalizeText(list.id),
    shape: normalizeText(list.shape),
    listTitle: normalizeText(list.listTitle),
    sourceUrl: normalizeText(list.sourceUrl) || null,
    sourceRole: normalizeText(list.sourceRole) || null,
    acceptedUwCourseCodes: uniqueStrings(list.acceptedUwCourseCodes),
    approvedUwCourseGroups: asArray(list.approvedUwCourseGroups)
      .map((group) => uniqueStrings(group))
      .filter((group) => group.length),
    mappedGrcCoursePaths: asArray(list.mappedGrcCoursePaths)
      .map((group) => uniqueStrings(group))
      .filter((group) => group.length),
    sourceEvidenceLines: uniqueStrings(list.sourceEvidenceLines),
    sourceEvidenceHeadings: uniqueStrings(list.sourceEvidenceHeadings),
    approvedListKey: normalizeText(list.approvedListKey) || null,
    generatedFilterId: normalizeText(list.generatedFilterId) || null,
  };
}

function summarizeParsedRequirementCourse(course, courseIndex, campusId, context) {
  const code = normalizeText(course.normalizedCourseCode || course.courseCode);
  if (code) {
    courseIndex.add(campusId, code, `${context} / parsed source`);
  }

  return {
    courseCode: normalizeText(course.courseCode),
    normalizedCourseCode: code,
    title: normalizeText(course.title) || null,
    credits: getCreditText(course),
    category: normalizeText(course.category) || null,
    requirementGroupId: normalizeText(course.requirementGroupId) || null,
    optionRole: normalizeText(course.optionRole) || null,
    sourceHeading: normalizeText(course.sourceHeading) || null,
    sourceCategory: normalizeText(course.sourceCategory) || null,
    notes: uniqueStrings(course.notes),
  };
}

function summarizeParsedBlock(block, courseIndex, campusId, context) {
  for (const code of uniqueStrings(block.parsedUwCourseCodes)) {
    courseIndex.add(campusId, code, `${context} / parsed source`);
  }

  return {
    id: normalizeText(block.id),
    sourceLabel: normalizeText(block.sourceLabel || block.primarySourceLabel),
    sourceUrl: normalizeText(block.sourceUrl || block.primarySourceUrl) || null,
    primarySourceUrl: normalizeText(block.primarySourceUrl) || null,
    sourceRole: normalizeText(block.sourceRole) || null,
    sourceRoleStatus: normalizeText(block.sourceRoleStatus) || null,
    canCreateScheduleRows: block.canCreateScheduleRows ?? null,
    supportOnly: block.supportOnly === true,
    nonSchedulable: block.nonSchedulable === true,
    requirementCueLines: uniqueStrings(block.requirementCueLines),
    parsedUwCourseCodes: uniqueStrings(block.parsedUwCourseCodes),
    parsedRequirementCourses: asArray(block.parsedRequirementCourses).map((course) =>
      summarizeParsedRequirementCourse(course, courseIndex, campusId, context)
    ),
    parsedRequirementGroups: asArray(block.parsedRequirementGroups).map((group) =>
      summarizeRequirementGroup(group, context, courseIndex, campusId)
    ),
  };
}

function buildPathwaySummary({ campus, plan, pathway, courseIndex }) {
  const pathwayId = pathway?.id ?? null;
  const resolvedPlan = resolveTransferPlannerStudentRuntimeMajorPlan(plan, pathwayId);
  const selectedPathwayId = resolvedPlan?.selectedPathwayId ?? pathwayId;
  const primarySource = getTransferPlannerPrimaryDegreeRequirementsSource(plan.id, selectedPathwayId);
  const parsedBlocks = getTransferPlannerParsedRequirementSourceBlocks(plan.id, selectedPathwayId);
  const planContext = `${campus.title} / ${plan.title}${
    selectedPathwayId ? ` / ${resolvedPlan.selectedPathwayLabel ?? selectedPathwayId}` : ""
  }`;

  const applicationChecklist = summarizeChecklist(
    resolvedPlan?.applicationChecklist,
    "application",
    planContext,
    courseIndex,
    campus.id
  );
  const beforeEnrollmentChecklist = summarizeChecklist(
    resolvedPlan?.beforeEnrollmentChecklist,
    "before enrollment",
    planContext,
    courseIndex,
    campus.id
  );
  const stayAtGrcChecklist = summarizeChecklist(
    resolvedPlan?.stayAtGrcChecklist,
    "stay at GRC",
    planContext,
    courseIndex,
    campus.id
  );
  const requirementGroups = asArray(resolvedPlan?.requirementGroups).map((group) =>
    summarizeRequirementGroup(group, planContext, courseIndex, campus.id)
  );
  const supportLists = asArray(resolvedPlan?.supportLists).map(summarizeSupportList);
  const parsedSourceBlocks = parsedBlocks.map((block) =>
    summarizeParsedBlock(block, courseIndex, campus.id, planContext)
  );

  const grcCourseCodes = uniqueStrings([
    ...getTransferPlannerGrcCourseList(resolvedPlan),
    ...applicationChecklist.flatMap((item) => item.grcCourseCodes),
    ...beforeEnrollmentChecklist.flatMap((item) => item.grcCourseCodes),
    ...stayAtGrcChecklist.flatMap((item) => item.grcCourseCodes),
    ...requirementGroups.flatMap((group) =>
      group.options.flatMap((option) => option.grcCourseCodes)
    ),
  ]);
  for (const code of grcCourseCodes) {
    courseIndex.add("grc", code, `${planContext} / planner course list`);
  }

  const uwCourseCodes = uniqueStrings([
    ...parsedSourceBlocks.flatMap((block) => block.parsedUwCourseCodes),
    ...parsedSourceBlocks.flatMap((block) =>
      block.parsedRequirementCourses.map((course) => course.normalizedCourseCode)
    ),
    ...requirementGroups.flatMap((group) => group.options.flatMap((option) => option.uwCourseCodes)),
    ...supportLists.flatMap((list) => list.acceptedUwCourseCodes),
  ]);
  for (const code of uwCourseCodes) {
    courseIndex.add(campus.id, code, `${planContext} / UW course found`);
  }

  const sourceLinks = summarizeLinks(resolvedPlan, pathway, primarySource, parsedBlocks);

  return {
    id: selectedPathwayId,
    label:
      normalizeText(resolvedPlan?.selectedPathwayLabel) ||
      normalizeText(pathway?.label) ||
      "Base major plan",
    summary:
      normalizeText(resolvedPlan?.selectedPathwaySummary) ||
      normalizeText(pathway?.summary) ||
      null,
    primarySource,
    sourceLinks,
    bestTrackId: normalizeText(resolvedPlan?.bestTrackId) || null,
    recommendedTrackSummary: normalizeText(resolvedPlan?.recommendedTrackSummary) || null,
    whyThisTrack: uniqueStrings(resolvedPlan?.whyThisTrack),
    validationNotes: uniqueStrings(resolvedPlan?.validationNotes),
    plannerNote: normalizeText(resolvedPlan?.plannerNote) || null,
    grcCourseListGuidance: normalizeText(resolvedPlan?.grcCourseListGuidance) || null,
    courseSummary: {
      uwCourseCodes,
      grcCourseCodes,
      optionLabelsWithoutCourseCodes: uniqueStrings(
        requirementGroups.flatMap((group) =>
          group.options
            .filter((option) => !option.uwCourseCodes.length && !option.grcCourseCodes.length)
            .map((option) => option.label)
        )
      ),
    },
    applicationChecklist,
    beforeEnrollmentChecklist,
    stayAtGrcChecklist,
    requirementGroups,
    requirementReplacements: asArray(resolvedPlan?.requirementReplacements).map((replacement) => ({
      baseRequirementId: normalizeText(replacement.baseRequirementId),
      replacedByRequirementId: normalizeText(replacement.replacedByRequirementId),
      appliesWhen: normalizeText(replacement.appliesWhen),
      replacementReason: normalizeText(replacement.replacementReason),
      sourceUrl: normalizeText(replacement.sourceUrl) || null,
      sourceHeading: normalizeText(replacement.sourceHeading) || null,
    })),
    supportLists,
    degreeMapSections: asArray(resolvedPlan?.degreeMapSections).map((section) => ({
      id: normalizeText(section.id),
      title: normalizeText(section.title),
      items: uniqueStrings(section.items),
      note: normalizeText(section.note) || null,
    })),
    parsedSourceBlocks,
  };
}

function buildExport() {
  const courseIndex = createCourseIndex();
  const campuses = TRANSFER_PLANNER_CAMPUSES.map((campus) => {
    const plans = getTransferPlannerStudentRuntimeMajorsForCampus(campus.id).map((plan) => {
      const pathways = getTransferPlannerStudentRuntimePathwaysForPlan(plan);
      const pathwayInputs = pathways.length ? pathways : [null];
      const pathwaySummaries = pathwayInputs.map((pathway) =>
        buildPathwaySummary({ campus, plan, pathway, courseIndex })
      );

      return {
        id: plan.id,
        campusId: plan.campusId,
        title: plan.title,
        shortTitle: plan.shortTitle,
        coverage: plan.coverage,
        sourceType: plan.sourceType ?? null,
        summary: normalizeText(plan.summary) || null,
        officialLinks: asArray(plan.officialLinks).map((link) => ({
          label: normalizeText(link.label),
          url: normalizeText(link.url),
        })),
        advisorFlags: uniqueStrings(plan.advisorFlags),
        validationNotes: uniqueStrings(plan.validationNotes),
        pathwayCount: pathways.length,
        pathways: pathwaySummaries,
      };
    });

    return {
      id: campus.id,
      title: campus.title,
      summary: campus.summary,
      officialLinks: asArray(campus.officialLinks).map((link) => ({
        label: normalizeText(link.label),
        url: normalizeText(link.url),
      })),
      majorCount: plans.length,
      majors: plans,
    };
  });

  const courses = courseIndex.toArray();
  const tracks = TRANSFER_PLANNER_TRACKS.map((track) => ({
    id: track.id,
    code: track.code,
    title: track.title,
    credential: track.credential,
    officialLinks: asArray(track.officialLinks).map((link) => ({
      label: normalizeText(link.label),
      url: normalizeText(link.url),
    })),
  }));

  const pathwayRecords = campuses.flatMap((campus) =>
    campus.majors.flatMap((major) =>
      major.pathways.map((pathway) => ({ campusId: campus.id, majorId: major.id, pathwayId: pathway.id }))
    )
  );
  const requirementGroups = campuses.flatMap((campus) =>
    campus.majors.flatMap((major) =>
      major.pathways.flatMap((pathway) => pathway.requirementGroups)
    )
  );
  const requirementOptions = requirementGroups.flatMap((group) => group.options);

  return {
    generatedAt: new Date().toISOString(),
    purpose:
      "AI fact-check export for comparing GatorGuide transfer-planner majors/pathways/options/courses against official online major sources.",
    reviewInstructions: [
      "For each major/pathway, open the primary/source URLs and compare official requirements with the planner requirement groups and checklists.",
      "Flag missing required courses, extra planner courses, wrong choice groups, stale course codes, incorrect credit counts, and pathway-specific differences.",
      "Use parsed source cue lines as hints only; the online source URL is the authority.",
      "Use the JSON file when exact option/course arrays are easier than reading the Markdown.",
    ],
    counts: {
      campuses: campuses.length,
      majors: campuses.reduce((sum, campus) => sum + campus.majors.length, 0),
      pathwayRecords: pathwayRecords.length,
      requirementGroups: requirementGroups.length,
      requirementOptions: requirementOptions.length,
      referencedCourses: courses.length,
      grcReferencedCourses: courses.filter((course) => course.schoolId === "grc").length,
      uwReferencedCourses: courses.filter((course) => course.schoolId !== "grc").length,
      tracks: tracks.length,
    },
    campuses,
    tracks,
    courses,
  };
}

function mdEscape(value) {
  return normalizeText(value).replace(/\|/g, "\\|");
}

function appendLinkLines(lines, links) {
  if (!links.length) {
    lines.push("- Source links: none");
    return;
  }

  lines.push("- Source links:");
  for (const link of links) {
    const details = [link.role, link.confidence, link.note].filter(Boolean).join("; ");
    lines.push(`  - ${link.label || link.url}: ${link.url}${details ? ` (${details})` : ""}`);
  }
}

function appendChecklist(lines, title, items) {
  lines.push(`#### ${title}`);
  if (!items.length) {
    lines.push("- none");
    return;
  }

  for (const item of items) {
    const details = [
      item.credits,
      item.requirementShape,
      item.sourceUrl ? `source: ${item.sourceUrl}` : null,
    ].filter(Boolean);
    lines.push(`- ${item.title}${details.length ? ` (${details.join("; ")})` : ""}`);
    if (item.grcCourses.length) lines.push(`  - GRC courses: ${item.grcCourses.join("; ")}`);
    if (item.alternatives.length) {
      lines.push(`  - Alternatives: ${item.alternatives.map((alt) => alt.join(" + ")).join("; ")}`);
    }
    if (item.note) lines.push(`  - Note: ${clipText(item.note)}`);
  }
}

function appendRequirementGroups(lines, groups) {
  lines.push("#### Requirement Groups and Options");
  if (!groups.length) {
    lines.push("- none");
    return;
  }

  for (const group of groups) {
    const groupDetails = [
      group.requirementType,
      group.requirementShape,
      group.credits,
      group.selectionCount != null ? `select ${group.selectionCount}` : null,
      group.requiredCount != null ? `required ${group.requiredCount}` : null,
      group.sourceUrl ? `source: ${group.sourceUrl}` : null,
    ].filter(Boolean);
    lines.push(`- ${group.label}${groupDetails.length ? ` (${groupDetails.join("; ")})` : ""}`);
    if (group.sourceHeading) lines.push(`  - Source heading: ${group.sourceHeading}`);
    if (group.sourceRowText) lines.push(`  - Source row: ${clipText(group.sourceRowText)}`);
    if (!group.options.length) {
      lines.push("  - Options: none");
      continue;
    }
    lines.push("  - Options:");
    for (const option of group.options) {
      const optionDetails = [
        option.credits,
        option.uwCourseCodes.length ? `UW: ${option.uwCourseCodes.join(", ")}` : null,
        option.grcCourseCodes.length ? `GRC: ${option.grcCourseCodes.join(", ")}` : null,
        option.categoryOption?.title ? `category: ${option.categoryOption.title}` : null,
      ].filter(Boolean);
      lines.push(`    - ${option.label}${optionDetails.length ? ` (${optionDetails.join("; ")})` : ""}`);
      if (option.grcMatches.length) lines.push(`      - GRC matches: ${option.grcMatches.join("; ")}`);
      if (option.notes.length) lines.push(`      - Notes: ${option.notes.map((note) => clipText(note, 240)).join("; ")}`);
    }
  }
}

function appendParsedSourceBlocks(lines, blocks) {
  lines.push("#### Parsed Source Cues");
  if (!blocks.length) {
    lines.push("- none");
    return;
  }

  for (const block of blocks) {
    lines.push(`- ${block.sourceLabel || block.id}: ${block.sourceUrl || "no URL"}`);
    lines.push(`  - Parsed UW courses: ${formatMaybeList(block.parsedUwCourseCodes)}`);
    const cueLines = block.requirementCueLines.slice(0, MAX_MARKDOWN_CUE_LINES_PER_BLOCK);
    for (const cueLine of cueLines) {
      lines.push(`  - ${clipText(cueLine, 260)}`);
    }
    if (block.requirementCueLines.length > cueLines.length) {
      lines.push(
        `  - ... ${block.requirementCueLines.length - cueLines.length} more cue lines in JSON export`
      );
    }
  }
}

function buildMarkdown(report, jsonPath) {
  const lines = [
    "# Transfer Planner AI Fact-Check Export",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "This export is meant for AI-assisted fact checking of GatorGuide transfer-planner data against official online major sources.",
    "",
    "Recommended review loop:",
    ...report.reviewInstructions.map((instruction) => `- ${instruction}`),
    "",
    `Structured JSON companion: ${normalizeDisplayPath(jsonPath)}`,
    "",
    "## Counts",
    "",
    `- Campuses: ${report.counts.campuses}`,
    `- Majors: ${report.counts.majors}`,
    `- Major/pathway records: ${report.counts.pathwayRecords}`,
    `- Requirement groups: ${report.counts.requirementGroups}`,
    `- Requirement options: ${report.counts.requirementOptions}`,
    `- Referenced courses: ${report.counts.referencedCourses} (${report.counts.grcReferencedCourses} GRC, ${report.counts.uwReferencedCourses} UW/campus)`,
    "",
    "## Campus And Major Exports",
    "",
  ];

  for (const campus of report.campuses) {
    lines.push(`## ${campus.title} (${campus.id})`, "");
    lines.push(`- Majors exported for this campus: ${campus.majorCount}`, "");
    lines.push(campus.summary || "No campus summary.", "");

    for (const major of campus.majors) {
      lines.push(`### ${major.title} (${major.id})`);
      lines.push(`- Coverage: ${major.coverage}`);
      lines.push(`- Source type: ${major.sourceType || "unknown"}`);
      if (major.summary) lines.push(`- Summary: ${major.summary}`);
      if (major.advisorFlags.length) lines.push(`- Advisor flags: ${major.advisorFlags.join("; ")}`);
      lines.push(`- Pathway records exported: ${major.pathways.length}`);
      lines.push("");

      for (const pathway of major.pathways) {
        lines.push(`#### Pathway: ${pathway.label}${pathway.id ? ` (${pathway.id})` : ""}`);
        if (pathway.summary) lines.push(`- Summary: ${pathway.summary}`);
        if (pathway.primarySource?.url) {
          lines.push(`- Primary source: ${pathway.primarySource.label || pathway.primarySource.url}: ${pathway.primarySource.url}`);
        }
        appendLinkLines(lines, pathway.sourceLinks);
        lines.push(`- UW/source courses found: ${formatMaybeList(pathway.courseSummary.uwCourseCodes)}`);
        lines.push(`- GRC planner courses found: ${formatMaybeList(pathway.courseSummary.grcCourseCodes)}`);
        if (pathway.courseSummary.optionLabelsWithoutCourseCodes.length) {
          lines.push(
            `- Option labels without explicit course codes: ${pathway.courseSummary.optionLabelsWithoutCourseCodes.join("; ")}`
          );
        }
        if (pathway.bestTrackId) lines.push(`- Recommended GRC track: ${pathway.bestTrackId}`);
        if (pathway.recommendedTrackSummary) lines.push(`- Track summary: ${pathway.recommendedTrackSummary}`);
        if (pathway.plannerNote) lines.push(`- Planner note: ${pathway.plannerNote}`);
        if (pathway.validationNotes.length) lines.push(`- Validation notes: ${pathway.validationNotes.join("; ")}`);
        lines.push("");

        appendChecklist(lines, "Application Checklist", pathway.applicationChecklist);
        appendChecklist(lines, "Before Enrollment Checklist", pathway.beforeEnrollmentChecklist);
        appendChecklist(lines, "Stay At GRC Checklist", pathway.stayAtGrcChecklist);
        appendRequirementGroups(lines, pathway.requirementGroups);
        appendParsedSourceBlocks(lines, pathway.parsedSourceBlocks);
        lines.push("");
      }
    }
  }

  lines.push("## Referenced Course Index", "");
  lines.push("| School | Code | Title | Credits | Referenced By Count |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const course of report.courses) {
    lines.push(
      `| ${mdEscape(course.schoolId)} | ${mdEscape(course.code)} | ${mdEscape(course.title || "")} | ${mdEscape(course.credits || "")} | ${course.referencedBy.length} |`
    );
  }
  lines.push("");

  return `${lines.join("\n")}\n`;
}

function main() {
  if (hasArg("--help")) {
    console.log(`Usage: node scripts/planner/export-transfer-planner-fact-check.cjs [--out-dir <dir>]`);
    console.log(`Writes ${normalizeDisplayPath(DEFAULT_MD_PATH)} and ${normalizeDisplayPath(DEFAULT_JSON_PATH)} by default.`);
    return;
  }

  const outDirArg = getArgValue("--out-dir");
  const outDir = outDirArg ? path.resolve(SOURCE_ROOT, outDirArg) : getPlannerTmpPath("exports");
  const mdPath = path.resolve(outDir, `${DEFAULT_BASENAME}.md`);
  const jsonPath = path.resolve(outDir, `${DEFAULT_BASENAME}.json`);

  const report = buildExport();
  writePlannerJsonReport(jsonPath, report);
  writePlannerMarkdownReport(mdPath, buildMarkdown(report, jsonPath));

  console.log("Transfer planner AI fact-check export written.");
  console.log(`Markdown: ${normalizeDisplayPath(mdPath)}`);
  console.log(`JSON: ${normalizeDisplayPath(jsonPath)}`);
  console.log(`Majors: ${report.counts.majors}`);
  console.log(`Major/pathway records: ${report.counts.pathwayRecords}`);
  console.log(`Requirement options: ${report.counts.requirementOptions}`);
  console.log(`Referenced courses: ${report.counts.referencedCourses}`);
}

main();
