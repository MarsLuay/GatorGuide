const {
  canRequirementSourceRoleCreateSchedulableRows,
  getRequirementSourceRoleStatus,
} = require("./source-scope.cjs");

function getCourseLevel(courseCode) {
  const match = String(courseCode ?? "").match(/\b(\d{3})/);
  return match ? Number(match[1]) : null;
}

function isLowerDivisionCourseCode(courseCode) {
  const level = getCourseLevel(courseCode);
  return level !== null && level < 300;
}

function normalizeAuditText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function isNonSchedulableContextualSourceRow(row) {
  const text = normalizeAuditText(
    [
      row?.uwRequirementLabel,
      row?.sourceHeading,
      row?.sourceRowText,
      row?.rawRowText,
    ].filter(Boolean).join(" ")
  );

  return (
    /\b(?:exploratory|relevant)\s+(?:engineering\s+)?electives?\b/i.test(text) &&
    /\b(?:do|does)\s+not\s+count\s+toward\b.{0,80}\brequired\b/i.test(text)
  );
}

function isSupportOrNonSchedulableGeneratedSourceRole(role) {
  const status = getRequirementSourceRoleStatus(String(role ?? "ignored"));
  return status === "support" || status === "non-schedulable" || status === "ignored";
}

function classifyGeneratedSeedIssue(row) {
  const hasScheduleSurface =
    row.canCreateScheduleRow !== false && row.generatedGrcCourseCodes.length > 0;
  const primaryScoped = /primary-schedulable/i.test(String(row.sourceScope ?? ""));
  const trustedSchedulableScope =
    row.canCreateScheduleRow &&
    row.sourceUrl &&
    !/support|non-schedulable|unscoped/i.test(String(row.sourceScope ?? ""));
  if (!hasScheduleSurface) {
    return "none";
  }

  if (String(row.sourceRole ?? "") === "approved-course-list") {
    return "approved-list-generated-required-row";
  }

  if (String(row.sourceRole ?? "") === "elective-list") {
    return "elective-list-generated-required-row";
  }

  if (
    ["upper-division-prerequisite-table", "non-schedulable-course-list", "ignored", "old-archival"].includes(
      String(row.sourceRole ?? "")
    ) ||
    /hidden|informational|non-schedulable|ignored/i.test(String(row.sourceScope ?? ""))
  ) {
    return "hidden-informational-row-scheduled";
  }

  if (
    !primaryScoped &&
    !trustedSchedulableScope &&
    (isSupportOrNonSchedulableGeneratedSourceRole(row.sourceRole) ||
      /support|non-schedulable/i.test(String(row.sourceScope ?? "")))
  ) {
    return "support-metadata-became-required";
  }

  if (!row.sourceUrl) {
    return "generated-row-without-primary-source";
  }

  if (
    !primaryScoped &&
    !trustedSchedulableScope &&
    !canRequirementSourceRoleCreateSchedulableRows(row.sourceRole)
  ) {
    return row.manualOverride ? "stale-manual-seed" : "unscoped-generated-seed";
  }

  return "none";
}

function classifyCoverageIssue(input) {
  if (input.nonSchedulableContextualSourceRow) {
    return null;
  }
  if (input.representedUnselectedRuntimeOption) {
    return null;
  }
  if (input.representedRuntimeUwOnlyOption) {
    return null;
  }
  const scheduledChoiceCourseCount =
    input.scheduledVisibleCourseCodes?.length ?? input.visibleCourseCodes.length;
  if (input.groupedChoiceMax != null && scheduledChoiceCourseCount > input.groupedChoiceMax) {
    return "over-scheduled-alternatives";
  }
  if (!input.grcEquivalents.length && input.parsedUwCourseCodes.some(isLowerDivisionCourseCode)) {
    // Source-only lower-division UW rows are valid evidence when the official
    // UW-GRC guide has no direct equivalent. Source-scope and parser audits still
    // verify that the rows were captured; coverage should only block when a
    // mapped Green River course is missing or over-selected.
    return null;
  }
  if (
    input.grcEquivalents.length &&
    (!input.generatedRuntimeRow || !input.visibleInTransferOnlyPlan)
  ) {
    return "missing-detected-course";
  }
  return null;
}

module.exports = {
  classifyGeneratedSeedIssue,
  classifyCoverageIssue,
  getCourseLevel,
  isLowerDivisionCourseCode,
  isNonSchedulableContextualSourceRow,
  isSupportOrNonSchedulableGeneratedSourceRole,
  normalizeAuditText,
};
