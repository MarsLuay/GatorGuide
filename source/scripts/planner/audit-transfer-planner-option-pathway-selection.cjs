const fs = require("fs");
const path = require("path");
const { ensureTmpLayout, getTmpPath } = require("../lib/tmp-layout.cjs");
const { writeReportPair } = require("./lib/planner-reporting.cjs");

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
  getTransferPlannerStudentRuntimeMajorsForCampus,
  getTransferPlannerStudentRuntimePathwaysForPlan,
  getTransferPlannerTrack,
  resolveTransferPlannerStudentRuntimeMajorPlan,
} = require("../../constants/transfer-planner-source/student-runtime");
const {
  auditRuntimeOptionResolution,
  buildRequirementStatuses,
  buildSuggestedQuarterPlan,
} = require("../../services/planning/transfer-planner.service");
const {
  collectSuggestedScheduleOptionGroups,
  getSuggestedScheduleResolvedOptionIds,
  getSuggestedScheduleVisibleOptions,
} = require("../../components/transfer-planner/transfer-planner-suggested-schedule");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const TMP_ROOT = ensureTmpLayout(REPO_ROOT).root;
const REFERENCE_DATE = new Date("2026-06-01T12:00:00.000Z");
const UW_CAMPUS_IDS = new Set(["uw-seattle", "uw-bothell", "uw-tacoma"]);

function getArgValue(name) {
  const prefix = `${name}=`;
  const match = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

function hasArg(name) {
  return process.argv.slice(2).includes(name);
}

function sanitizeOutputSegment(value) {
  return String(value ?? "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function getOutputStem() {
  return unique([
    "transfer-planner-option-pathway-selection-audit",
    sanitizeOutputSegment(getArgValue("--mode") ?? "sample"),
    sanitizeOutputSegment(getArgValue("--target-campus-id")),
    sanitizeOutputSegment(getArgValue("--target-plan-id")),
  ]).join("-");
}

function getOutputJsonPath() {
  return getTmpPath(REPO_ROOT, "reports", `${getOutputStem()}.json`);
}

function getOutputMarkdownPath() {
  return getTmpPath(REPO_ROOT, "reports", `${getOutputStem()}.md`);
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function formatCount(value, noun) {
  return `${value} ${noun}${value === 1 ? "" : "s"}`;
}

function normalizeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function getRequirementOptionId(group, option, optionIndex) {
  return (
    normalizeText(option?.id) ||
    `${group.id || "requirement-group"}:requirement-option:${optionIndex + 1}`
  );
}

function getOptionCreditValue(option) {
  const rawCredits =
    option?.credits ??
    option?.creditAmount ??
    option?.creditMax ??
    option?.creditMin ??
    option?.categoryOption?.credits ??
    0;
  const credits = Number(rawCredits);
  return Number.isFinite(credits) && credits > 0 ? credits : 0;
}

function getSelectionTargetCount(group) {
  const count =
    group.selectionCount ??
    group.requiredCount ??
    group.minCourses ??
    group.maxCourses ??
    1;
  const normalizedCount = Number(count);
  return Math.max(
    1,
    Math.min(
      array(group.options).length || 1,
      Number.isFinite(normalizedCount) ? Math.trunc(normalizedCount) : 1
    )
  );
}

function getCreditTarget(group) {
  const creditTarget =
    group.minCredits ??
    group.requiredCredits ??
    group.maxCredits ??
    group.maxRequiredCredits ??
    null;
  const normalizedCreditTarget = Number(creditTarget);
  return Number.isFinite(normalizedCreditTarget) && normalizedCreditTarget > 0
    ? normalizedCreditTarget
    : null;
}

function pickSelectedOptionIdsForGroup(group, targetOptionIndex, strategy) {
  const options = array(group.options);
  if (!options.length) return [];

  const optionIds = options.map((option, optionIndex) =>
    getRequirementOptionId(group, option, optionIndex)
  );
  if (optionIds.length === 1) return optionIds;

  const targetIndex =
    targetOptionIndex == null
      ? strategy === "last"
        ? optionIds.length - 1
        : strategy === "middle"
          ? Math.floor(optionIds.length / 2)
          : 0
      : Math.max(0, Math.min(optionIds.length - 1, targetOptionIndex));
  const selected = [optionIds[targetIndex]];
  const selectedSet = new Set(selected);
  const creditTarget = getCreditTarget(group);

  if (creditTarget) {
    let selectedCredits = getOptionCreditValue(options[targetIndex]);
    for (let offset = 1; offset < options.length && selectedCredits < creditTarget; offset += 1) {
      const nextIndex =
        strategy === "last"
          ? (targetIndex - offset + options.length) % options.length
          : (targetIndex + offset) % options.length;
      const nextId = optionIds[nextIndex];
      if (!nextId || selectedSet.has(nextId)) continue;
      selected.push(nextId);
      selectedSet.add(nextId);
      selectedCredits += getOptionCreditValue(options[nextIndex]);
    }
    return selected;
  }

  const targetCount = getSelectionTargetCount(group);
  for (let offset = 1; offset < options.length && selected.length < targetCount; offset += 1) {
    const nextIndex =
      strategy === "last"
        ? (targetIndex - offset + options.length) % options.length
        : (targetIndex + offset) % options.length;
    const nextId = optionIds[nextIndex];
    if (!nextId || selectedSet.has(nextId)) continue;
    selected.push(nextId);
    selectedSet.add(nextId);
  }

  return selected;
}

function isOptionGroup(group) {
  return Boolean(group?.id && Array.isArray(group.options) && group.options.length > 1);
}

function collectRequirementOptionGroups(plan) {
  const checklistItems = [
    ...array(plan.applicationChecklist).map((item) => ({ phase: "application", item })),
    ...array(plan.beforeEnrollmentChecklist).map((item) => ({
      phase: "before-enrollment",
      item,
    })),
    ...array(plan.stayAtGrcChecklist).map((item) => ({ phase: "stay-at-grc", item })),
  ];
  const groupRecords = [
    ...array(plan.requirementGroups).map((group) => ({
      phase: "plan-requirement-group",
      itemId: null,
      selectedRequirementOptionIds: [],
      group,
    })),
    ...checklistItems.map((entry) => ({
      phase: entry.phase,
      itemId: entry.item?.id ?? null,
      selectedRequirementOptionIds: array(entry.item?.selectedRequirementOptionIds),
      group: entry.item?.requirementGroup ?? null,
    })),
  ];
  const groupsById = new Map();

  for (const record of groupRecords) {
    if (!isOptionGroup(record.group)) continue;
    const existing = groupsById.get(record.group.id);
    if (existing) {
      existing.phases = unique([...existing.phases, record.phase]);
      existing.itemIds = unique([...existing.itemIds, record.itemId].filter(Boolean));
      existing.selectedRequirementOptionIds = unique([
        ...existing.selectedRequirementOptionIds,
        ...record.selectedRequirementOptionIds,
      ]);
      continue;
    }

    groupsById.set(record.group.id, {
      id: record.group.id,
      label: normalizeText(record.group.label || record.group.sourceHeading || record.group.id),
      phases: [record.phase],
      itemIds: record.itemId ? [record.itemId] : [],
      requirementType: record.group.requirementType ?? null,
      requirementShape: record.group.requirementShape ?? null,
      selectionCount: record.group.selectionCount ?? record.group.requiredCount ?? null,
      minCredits: record.group.minCredits ?? null,
      maxCredits: record.group.maxCredits ?? null,
      optionCount: record.group.options.length,
      selectedRequirementOptionIds: unique(record.selectedRequirementOptionIds),
      group: record.group,
    });
  }

  return [...groupsById.values()].sort((left, right) => left.id.localeCompare(right.id));
}

function buildSelectionMap(groups, strategy) {
  const selectedRequirementOptionIdsByGroup = {};
  for (const groupRecord of groups) {
    selectedRequirementOptionIdsByGroup[groupRecord.id] = pickSelectedOptionIdsForGroup(
      groupRecord.group,
      null,
      strategy
    );
  }
  return selectedRequirementOptionIdsByGroup;
}

function buildOptionSweepScenarios(groups) {
  const scenarios = [];
  for (const groupRecord of groups) {
    for (const [optionIndex, option] of array(groupRecord.group.options).entries()) {
      const optionId = getRequirementOptionId(groupRecord.group, option, optionIndex);
      scenarios.push({
        id: `select-option:${groupRecord.id}:${optionId}`,
        kind: "single-option",
        targetGroupId: groupRecord.id,
        targetOptionId: optionId,
        selectedRequirementOptionIdsByGroup: {
          [groupRecord.id]: pickSelectedOptionIdsForGroup(
            groupRecord.group,
            optionIndex,
            "first"
          ),
        },
      });
    }
  }
  return scenarios;
}

function buildScenarios(groups, mode) {
  const scenarios = [
    {
      id: "default",
      kind: "default",
      selectedRequirementOptionIdsByGroup: {},
    },
  ];

  if (!groups.length || mode === "default") {
    return scenarios;
  }

  scenarios.push(
    {
      id: "all-first-options",
      kind: "bulk-first",
      selectedRequirementOptionIdsByGroup: buildSelectionMap(groups, "first"),
    },
    {
      id: "all-middle-options",
      kind: "bulk-middle",
      selectedRequirementOptionIdsByGroup: buildSelectionMap(groups, "middle"),
    },
    {
      id: "all-last-options",
      kind: "bulk-last",
      selectedRequirementOptionIdsByGroup: buildSelectionMap(groups, "last"),
    }
  );

  if (mode === "option-sweep") {
    scenarios.push(...buildOptionSweepScenarios(groups));
  }

  return scenarios;
}

function collectVisibleScheduleGroupSummaries(quarters) {
  return collectSuggestedScheduleOptionGroups(quarters).map((group) => {
    const optionIds = array(group.options).map((option) => option.id).filter(Boolean);
    const resolvedOptionIds = getSuggestedScheduleResolvedOptionIds(group);
    const visibleOptionIds = getSuggestedScheduleVisibleOptions(group)
      .map((option) => option.id)
      .filter(Boolean);
    return {
      id: group.id,
      title: group.title ?? null,
      optionCount: optionIds.length,
      selectedOptionIds: array(group.selectedOptionIds),
      resolvedOptionIds,
      visibleOptionIds,
      selectionSource: group.selectionSource ?? null,
      isSelectionPrompt: group.isSelectionPrompt === true,
      duplicateOptionIds: optionIds.filter((optionId, index) => optionIds.indexOf(optionId) !== index),
      unknownSelectedOptionIds: array(group.selectedOptionIds).filter(
        (optionId) => !optionIds.includes(optionId)
      ),
      unknownResolvedOptionIds: resolvedOptionIds.filter((optionId) => !optionIds.includes(optionId)),
    };
  });
}

function scenarioTargetResolvedByRuntimeAudit(input) {
  if (!input.scenario.targetGroupId || !input.scenario.targetOptionId) {
    return false;
  }

  const rows = auditRuntimeOptionResolution({
    plan: input.plan,
    suggestedPlan: input.quarters,
    completedCourses: [],
    selectedRequirementOptionIdsByGroup:
      input.scenario.selectedRequirementOptionIdsByGroup,
  });
  return rows.some((row) => {
    if (row.groupId !== input.scenario.targetGroupId) {
      return false;
    }

    const acceptedOptionIds = new Set([
      ...array(row.selectedOptionIds),
      ...array(row.scheduledOptionIds),
    ]);
    return acceptedOptionIds.has(input.scenario.targetOptionId) && row.issue === "none";
  });
}

function buildScenarioPlan(input) {
  const completedCourses = [];
  const applicationStatuses = buildRequirementStatuses(
    array(input.plan.applicationChecklist),
    completedCourses
  );
  const beforeEnrollmentStatuses = buildRequirementStatuses(
    array(input.plan.beforeEnrollmentChecklist),
    completedCourses
  );
  const stayAtGrcStatuses = buildRequirementStatuses(
    array(input.plan.stayAtGrcChecklist),
    completedCourses
  );

  return buildSuggestedQuarterPlan({
    plan: input.plan,
    plannerCollegeId: "uw",
    applicationStatuses,
    beforeEnrollmentStatuses,
    stayAtGrcStatuses,
    completedCourses,
    currentCourseKeys: [],
    currentCourseLabels: [],
    track: getTransferPlannerTrack(input.plan.bestTrackId ?? null),
    includeStayAtGrcCourses: false,
    includeStemPrepCourses: true,
    includeSummerQuarter: false,
    selectedRequirementOptionIdsByGroup: input.selectedRequirementOptionIdsByGroup,
    referenceDate: REFERENCE_DATE,
  });
}

function collectSelectableScheduleOptionGroups(plan) {
  const quarters = buildScenarioPlan({
    plan,
    selectedRequirementOptionIdsByGroup: {},
  });
  const groupsById = new Map();

  for (const group of collectSuggestedScheduleOptionGroups(quarters)) {
    const visibleOptions = getSuggestedScheduleVisibleOptions(group);
    if (!group?.id || visibleOptions.length < 2) continue;
    if (groupsById.has(group.id)) continue;

    groupsById.set(group.id, {
      id: group.id,
      label: normalizeText(group.title || group.id),
      optionCount: visibleOptions.length,
      originalOptionCount: array(group.options).length,
      group: {
        ...group,
        options: visibleOptions,
      },
    });
  }

  return [...groupsById.values()].sort((left, right) => left.id.localeCompare(right.id));
}

function auditScenario(input) {
  const issues = [];
  const selectedGroups = Object.keys(input.scenario.selectedRequirementOptionIdsByGroup ?? {});
  let quarterCount = 0;
  let courseCount = 0;
  let visibleOptionGroupCount = 0;
  let visibleTargetGroup = null;

  try {
    const quarters = buildScenarioPlan({
      plan: input.plan,
      selectedRequirementOptionIdsByGroup:
        input.scenario.selectedRequirementOptionIdsByGroup,
    });
    if (!Array.isArray(quarters)) {
      issues.push({
        code: "schedule-result-not-array",
        severity: "error",
        message: "buildSuggestedQuarterPlan did not return an array.",
      });
      return { ...input.scenario, quarterCount, courseCount, visibleOptionGroupCount, issues };
    }

    quarterCount = quarters.length;
    courseCount = quarters.reduce((sum, quarter) => sum + array(quarter.courses).length, 0);
    const visibleGroups = collectVisibleScheduleGroupSummaries(quarters);
    visibleOptionGroupCount = visibleGroups.length;
    visibleTargetGroup =
      input.scenario.targetGroupId &&
      visibleGroups.find((group) => group.id === input.scenario.targetGroupId);

    for (const [quarterIndex, quarter] of quarters.entries()) {
      if (!normalizeText(quarter.label)) {
        issues.push({
          code: "blank-quarter-label",
          severity: "error",
          message: `Quarter at index ${quarterIndex} has no label.`,
        });
      }
      for (const [courseIndex, course] of array(quarter.courses).entries()) {
        if (!normalizeText(course.label)) {
          issues.push({
            code: "blank-course-label",
            severity: "error",
            message: `Course at quarter ${quarterIndex}, index ${courseIndex} has no label.`,
          });
        }
      }
    }

    for (const group of visibleGroups) {
      if (!normalizeText(group.id)) {
        issues.push({
          code: "visible-option-group-missing-id",
          severity: "error",
          message: "A visible schedule option group has no id.",
        });
      }
      if (group.optionCount < 2) {
        issues.push({
          code: "visible-option-group-too-small",
          severity: "warning",
          message: `Visible option group ${group.id} has fewer than two options.`,
        });
      }
      if (group.duplicateOptionIds.length) {
        issues.push({
          code: "duplicate-visible-option-ids",
          severity: "error",
          message: `Visible option group ${group.id} has duplicate option ids.`,
          optionIds: unique(group.duplicateOptionIds),
        });
      }
      if (group.unknownSelectedOptionIds.length) {
        issues.push({
          code: "unknown-selected-option-id",
          severity: "error",
          message: `Visible option group ${group.id} selected ids that are not in its options.`,
          optionIds: group.unknownSelectedOptionIds,
        });
      }
      if (group.unknownResolvedOptionIds.length) {
        issues.push({
          code: "unknown-resolved-option-id",
          severity: "error",
          message: `Visible option group ${group.id} resolved ids that are not in its options.`,
          optionIds: group.unknownResolvedOptionIds,
        });
      }
      if (group.visibleOptionIds.length < 1) {
        issues.push({
          code: "no-visible-options",
          severity: "error",
          message: `Visible option group ${group.id} has no visible option choices.`,
        });
      }
    }

    if (visibleTargetGroup && input.scenario.targetOptionId) {
      const targetSelected = new Set([
        ...visibleTargetGroup.selectedOptionIds,
        ...visibleTargetGroup.resolvedOptionIds,
      ]).has(input.scenario.targetOptionId);
      const targetResolvedByRuntimeAudit = targetSelected
        ? false
        : scenarioTargetResolvedByRuntimeAudit({
            plan: input.plan,
            quarters,
            scenario: input.scenario,
          });
      if (!targetSelected && !targetResolvedByRuntimeAudit) {
        issues.push({
          code: "target-option-not-selected",
          severity: "error",
          message:
            "A user-selected option group is visible, but the selected target option was not selected or resolved.",
          groupId: input.scenario.targetGroupId,
          optionId: input.scenario.targetOptionId,
          selectedOptionIds: visibleTargetGroup.selectedOptionIds,
          resolvedOptionIds: visibleTargetGroup.resolvedOptionIds,
        });
      }
    }
  } catch (error) {
    issues.push({
      code: "scenario-threw",
      severity: "error",
      message: error?.stack || error?.message || String(error),
    });
  }

  return {
    id: input.scenario.id,
    kind: input.scenario.kind,
    selectedGroupCount: selectedGroups.length,
    targetGroupId: input.scenario.targetGroupId ?? null,
    targetOptionId: input.scenario.targetOptionId ?? null,
    quarterCount,
    courseCount,
    visibleOptionGroupCount,
    issues,
  };
}

function getCampusIds() {
  const targetCampusId = getArgValue("--target-campus-id");
  if (targetCampusId) return [targetCampusId];
  return TRANSFER_PLANNER_CAMPUSES.map((campus) => campus.id).filter((campusId) =>
    UW_CAMPUS_IDS.has(campusId)
  );
}

function getMajorRecords() {
  const targetPlanId = getArgValue("--target-plan-id");
  const records = [];

  for (const campusId of getCampusIds()) {
    for (const basePlan of getTransferPlannerStudentRuntimeMajorsForCampus(campusId)) {
      if (targetPlanId && basePlan.id !== targetPlanId) continue;
      const pathways = getTransferPlannerStudentRuntimePathwaysForPlan(basePlan);
      records.push({
        campusId,
        basePlan,
        pathways: pathways.length
          ? pathways
          : [
              {
                id: null,
                label: "Base plan",
              },
            ],
      });
    }
  }

  return records.sort((left, right) => {
    const campusDelta = left.campusId.localeCompare(right.campusId);
    if (campusDelta !== 0) return campusDelta;
    return left.basePlan.id.localeCompare(right.basePlan.id);
  });
}

function auditPathwayVariant(input) {
  const requestedPathwayId = input.pathway.id ?? null;
  const issues = [];
  let plan = null;

  try {
    plan = resolveTransferPlannerStudentRuntimeMajorPlan(input.basePlan, requestedPathwayId);
  } catch (error) {
    return {
      planId: input.basePlan.id,
      title: input.basePlan.title,
      campusId: input.campusId,
      requestedPathwayId,
      selectedPathwayId: null,
      selectedPathwayLabel: null,
      requirementOptionGroupCount: 0,
      requirementOptionCount: 0,
      selectableOptionGroupCount: 0,
      selectableOptionCount: 0,
      scenarioCount: 0,
      scenarios: [],
      issues: [
        {
          code: "pathway-resolution-threw",
          severity: "error",
          message: error?.stack || error?.message || String(error),
        },
      ],
    };
  }

  if (!plan) {
    issues.push({
      code: "pathway-resolution-empty",
      severity: "error",
      message: "Pathway resolution returned no plan.",
    });
  }

  if (plan && requestedPathwayId && plan.selectedPathwayId !== requestedPathwayId) {
    issues.push({
      code: "pathway-resolution-mismatch",
      severity: "error",
      message: "Resolved plan selected a different pathway than the requested pathway.",
      requestedPathwayId,
      selectedPathwayId: plan.selectedPathwayId ?? null,
    });
  }

  const groups = plan ? collectRequirementOptionGroups(plan) : [];
  const selectableGroups = plan ? collectSelectableScheduleOptionGroups(plan) : [];
  const scenarios = plan
    ? buildScenarios(selectableGroups, input.mode)
        .slice(0, input.maxScenariosPerVariant ?? Number.POSITIVE_INFINITY)
        .map((scenario) => auditScenario({ plan, scenario }))
    : [];
  const scenarioIssues = scenarios.flatMap((scenario) =>
    scenario.issues.map((issue) => ({ ...issue, scenarioId: scenario.id }))
  );

  return {
    planId: input.basePlan.id,
    title: input.basePlan.title,
    campusId: input.campusId,
    requestedPathwayId,
    selectedPathwayId: plan?.selectedPathwayId ?? null,
    selectedPathwayLabel: plan?.selectedPathwayLabel ?? input.pathway.label ?? null,
    requirementOptionGroupCount: groups.length,
    requirementOptionCount: groups.reduce((sum, group) => sum + group.optionCount, 0),
    selectableOptionGroupCount: selectableGroups.length,
    selectableOptionCount: selectableGroups.reduce((sum, group) => sum + group.optionCount, 0),
    scenarioCount: scenarios.length,
    scenarios,
    issues: [...issues, ...scenarioIssues],
  };
}

function auditMajor(record, options) {
  const variants = record.pathways.map((pathway) =>
    auditPathwayVariant({
      campusId: record.campusId,
      basePlan: record.basePlan,
      pathway,
      mode: options.mode,
      maxScenariosPerVariant: options.maxScenariosPerVariant,
    })
  );

  return {
    planId: record.basePlan.id,
    title: record.basePlan.title,
    campusId: record.campusId,
    pathwayCount: record.pathways.length,
    pathwayLabels: record.pathways.map((pathway) => ({
      id: pathway.id,
      label: pathway.label,
    })),
    variantCount: variants.length,
    requirementOptionGroupCount: variants.reduce(
      (sum, variant) => sum + variant.requirementOptionGroupCount,
      0
    ),
    requirementOptionCount: variants.reduce(
      (sum, variant) => sum + variant.requirementOptionCount,
      0
    ),
    selectableOptionGroupCount: variants.reduce(
      (sum, variant) => sum + variant.selectableOptionGroupCount,
      0
    ),
    selectableOptionCount: variants.reduce(
      (sum, variant) => sum + variant.selectableOptionCount,
      0
    ),
    scenarioCount: variants.reduce((sum, variant) => sum + variant.scenarioCount, 0),
    issueCount: variants.reduce((sum, variant) => sum + variant.issues.length, 0),
    variants,
  };
}

function getIssueSummary(majors) {
  const issueRows = majors.flatMap((major) =>
    major.variants.flatMap((variant) =>
      variant.issues.map((issue) => ({
        campusId: major.campusId,
        planId: major.planId,
        title: major.title,
        pathwayId: variant.selectedPathwayId ?? variant.requestedPathwayId,
        pathwayLabel: variant.selectedPathwayLabel,
        scenarioId: issue.scenarioId ?? null,
        code: issue.code,
        severity: issue.severity,
        message: issue.message,
      }))
    )
  );
  const byCode = {};
  for (const row of issueRows) {
    byCode[row.code] = (byCode[row.code] ?? 0) + 1;
  }
  return { issueRows, byCode };
}

function buildMarkdown(report) {
  const outputJsonPath = getOutputJsonPath();
  const outputMarkdownPath = getOutputMarkdownPath();
  const lines = [
    "# Transfer Planner Option/Pathway Selection Audit",
    "",
    `Generated: ${report.generatedAt}`,
    `Mode: ${report.mode}`,
    `Majors audited: ${report.summary.majorsAudited}`,
    `Pathway variants audited: ${report.summary.pathwayVariantsAudited}`,
    `Raw source requirement option groups found: ${report.summary.requirementOptionGroupsAudited}`,
    `Raw source requirement options found: ${report.summary.requirementOptionsAudited}`,
    `Schedule-selectable option groups swept: ${report.summary.selectableOptionGroupsAudited}`,
    `Schedule-selectable options swept: ${report.summary.selectableOptionsAudited}`,
    `Schedule selection scenarios run: ${report.summary.scenariosRun}`,
    `Issues found: ${report.summary.issuesFound}`,
    "",
    "## Campus Counts",
    "",
    "| Campus | Majors | Pathway variants | Source option groups | Selectable option groups | Scenarios | Issues |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];

  for (const row of report.summary.byCampus) {
    lines.push(
      `| ${row.campusId} | ${row.majorsAudited} | ${row.pathwayVariantsAudited} | ${row.requirementOptionGroupsAudited} | ${row.selectableOptionGroupsAudited} | ${row.scenariosRun} | ${row.issuesFound} |`
    );
  }

  lines.push("", "## Issues", "");
  if (!report.issues.length) {
    lines.push("No issues found by this audit.");
  } else {
    lines.push("| Severity | Code | Campus | Plan | Pathway | Scenario | Message |");
    lines.push("| --- | --- | --- | --- | --- | --- | --- |");
    for (const issue of report.issues.slice(0, 250)) {
      lines.push(
        `| ${issue.severity} | ${issue.code} | ${issue.campusId} | ${issue.planId} | ${issue.pathwayId ?? ""} | ${issue.scenarioId ?? ""} | ${normalizeText(issue.message).replace(/\|/g, "/")} |`
      );
    }
    if (report.issues.length > 250) {
      lines.push(`|  |  |  |  |  |  | ${report.issues.length - 250} more issue rows in JSON report. |`);
    }
  }

  lines.push("", "## Major Review Table", "");
  lines.push("| Campus | Plan | Pathways | Source groups | Source options | Selectable groups | Selectable options | Scenarios | Issues |");
  lines.push("| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const major of report.majors) {
    lines.push(
      `| ${major.campusId} | ${major.planId} | ${major.pathwayCount} | ${major.requirementOptionGroupCount} | ${major.requirementOptionCount} | ${major.selectableOptionGroupCount} | ${major.selectableOptionCount} | ${major.scenarioCount} | ${major.issueCount} |`
    );
  }

  lines.push("", "## Variant Review Table", "");
  lines.push(
    "| Campus | Plan | Pathway | Source groups | Source options | Selectable groups | Selectable options | Scenarios | Issues |"
  );
  lines.push("| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const major of report.majors) {
    for (const variant of major.variants) {
      lines.push(
        `| ${major.campusId} | ${major.planId} | ${variant.selectedPathwayLabel ?? variant.selectedPathwayId ?? ""} | ${variant.requirementOptionGroupCount} | ${variant.requirementOptionCount} | ${variant.selectableOptionGroupCount} | ${variant.selectableOptionCount} | ${variant.scenarioCount} | ${variant.issues.length} |`
      );
    }
  }

  lines.push(
    "",
    "## Notes",
    "",
    "- This audit exercises current generated student-runtime pathway resolution and suggested-schedule selection handling.",
    "- Raw source requirement options without a visible schedule choice are counted but not treated as user-selectable scenario failures.",
    "- It does not fetch or re-parse official sources; source correctness is covered by separate parser/source-backed audits.",
    `- JSON report: ${path.relative(REPO_ROOT, outputJsonPath)}`,
    `- Markdown report: ${path.relative(REPO_ROOT, outputMarkdownPath)}`
  );

  return lines;
}

function summarizeByCampus(majors) {
  return [...UW_CAMPUS_IDS].map((campusId) => {
    const campusMajors = majors.filter((major) => major.campusId === campusId);
    return {
      campusId,
      majorsAudited: campusMajors.length,
      pathwayVariantsAudited: campusMajors.reduce((sum, major) => sum + major.variantCount, 0),
      requirementOptionGroupsAudited: campusMajors.reduce(
        (sum, major) => sum + major.requirementOptionGroupCount,
        0
      ),
      requirementOptionsAudited: campusMajors.reduce(
        (sum, major) => sum + major.requirementOptionCount,
        0
      ),
      selectableOptionGroupsAudited: campusMajors.reduce(
        (sum, major) => sum + major.selectableOptionGroupCount,
        0
      ),
      selectableOptionsAudited: campusMajors.reduce(
        (sum, major) => sum + major.selectableOptionCount,
        0
      ),
      scenariosRun: campusMajors.reduce((sum, major) => sum + major.scenarioCount, 0),
      issuesFound: campusMajors.reduce((sum, major) => sum + major.issueCount, 0),
    };
  });
}

function main() {
  const mode = getArgValue("--mode") ?? "sample";
  const reportOnly = hasArg("--report-only");
  const quiet = hasArg("--quiet");
  const maxScenariosPerVariantValue = getArgValue("--max-scenarios-per-variant");
  const maxScenariosPerVariant = maxScenariosPerVariantValue
    ? Number.parseInt(maxScenariosPerVariantValue, 10)
    : null;
  const majorRecords = getMajorRecords();
  const majors = [];
  for (const [recordIndex, record] of majorRecords.entries()) {
    if (!quiet) {
      console.log(
        `[${recordIndex + 1}/${majorRecords.length}] ${record.campusId} ${record.basePlan.id} (${formatCount(record.pathways.length, "pathway")})`
      );
    }
    majors.push(auditMajor(record, {
      mode,
      maxScenariosPerVariant:
        maxScenariosPerVariant && maxScenariosPerVariant > 0
          ? maxScenariosPerVariant
          : null,
    }));
  }
  const issueSummary = getIssueSummary(majors);
  const summary = {
    majorsAudited: majors.length,
    pathwayVariantsAudited: majors.reduce((sum, major) => sum + major.variantCount, 0),
    requirementOptionGroupsAudited: majors.reduce(
      (sum, major) => sum + major.requirementOptionGroupCount,
      0
    ),
    requirementOptionsAudited: majors.reduce(
      (sum, major) => sum + major.requirementOptionCount,
      0
    ),
    selectableOptionGroupsAudited: majors.reduce(
      (sum, major) => sum + major.selectableOptionGroupCount,
      0
    ),
    selectableOptionsAudited: majors.reduce(
      (sum, major) => sum + major.selectableOptionCount,
      0
    ),
    scenariosRun: majors.reduce((sum, major) => sum + major.scenarioCount, 0),
    issuesFound: issueSummary.issueRows.length,
    issuesByCode: issueSummary.byCode,
    byCampus: summarizeByCampus(majors),
  };
  const report = {
    generatedAt: new Date().toISOString(),
    mode,
    targetCampusId: getArgValue("--target-campus-id"),
    targetPlanId: getArgValue("--target-plan-id"),
    reportOnly,
    summary,
    issues: issueSummary.issueRows,
    majors,
  };
  const outputJsonPath = getOutputJsonPath();
  const outputMarkdownPath = getOutputMarkdownPath();

  writeReportPair({
    jsonPath: outputJsonPath,
    markdownPath: outputMarkdownPath,
    report,
    markdown: buildMarkdown(report),
  });

  console.log(`Option/pathway selection audit mode: ${mode}`);
  console.log(`Majors audited: ${formatCount(summary.majorsAudited, "major")}`);
  console.log(
    `Pathway variants audited: ${formatCount(summary.pathwayVariantsAudited, "variant")}`
  );
  console.log(
    `Raw source requirement option groups found: ${formatCount(
      summary.requirementOptionGroupsAudited,
      "group"
    )}`
  );
  console.log(
    `Schedule-selectable option groups swept: ${formatCount(
      summary.selectableOptionGroupsAudited,
      "group"
    )}`
  );
  console.log(
    `Schedule-selectable options swept: ${formatCount(
      summary.selectableOptionsAudited,
      "option"
    )}`
  );
  console.log(`Scenarios run: ${formatCount(summary.scenariosRun, "scenario")}`);
  console.log(`Issues found: ${summary.issuesFound}`);
  console.log(`Report: ${path.relative(REPO_ROOT, outputMarkdownPath)}`);
  console.log(`JSON: ${path.relative(REPO_ROOT, outputJsonPath)}`);

  if (summary.issuesFound > 0 && !reportOnly) {
    process.exitCode = 1;
  }
}

main();
