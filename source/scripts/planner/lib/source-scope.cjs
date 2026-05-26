const PRIMARY_SOURCE_ROLES = new Set([
  "degree-requirements",
  "catalog",
  "curriculum",
  "worksheet",
  "official-catalog",
  "primary-degree-requirements",
  "department-requirements",
  "pathway-degree-sheet",
]);

const SUPPORT_SOURCE_ROLES = new Set([
  "admissions",
  "overview",
  "equivalency",
  "availability",
  "other",
  "approved-course-list",
  "elective-list",
  "support-source",
  "admission-prerequisite-source",
  "admissions-preparation",
  "sample-schedule",
  "curriculum-map",
  "transfer-equivalency",
  "matched-grc-track",
]);

const NON_SCHEDULABLE_SOURCE_ROLES = new Set([
  "upper-division-prerequisite-table",
  "non-schedulable-course-list",
]);

const IGNORED_SOURCE_ROLES = new Set(["old-archival", "ignored"]);

const PARSEABLE_SUPPORT_ROLES = new Set([
  "approved-course-list",
  "elective-list",
  "upper-division-prerequisite-table",
  "non-schedulable-course-list",
  "sample-schedule",
  "admission-prerequisite-source",
  "admissions-preparation",
  "transfer-equivalency",
]);

const ROLE_STATUS_BY_ROLE = Object.freeze({
  ...Object.fromEntries([...PRIMARY_SOURCE_ROLES].map((role) => [role, "primary"])),
  ...Object.fromEntries([...SUPPORT_SOURCE_ROLES].map((role) => [role, "support"])),
  ...Object.fromEntries(
    [...NON_SCHEDULABLE_SOURCE_ROLES].map((role) => [role, "non-schedulable"])
  ),
  ...Object.fromEntries([...IGNORED_SOURCE_ROLES].map((role) => [role, "ignored"])),
});

function getRequirementSourceRoleStatus(sourceRole) {
  return ROLE_STATUS_BY_ROLE[String(sourceRole ?? "ignored")] ?? "ignored";
}

function buildRequirementSourceScope(sourceRole) {
  const normalizedRole = String(sourceRole ?? "ignored");
  const sourceRoleStatus = getRequirementSourceRoleStatus(normalizedRole);
  const primary = sourceRoleStatus === "primary";
  const supportOnly = sourceRoleStatus === "support";
  const nonSchedulable = sourceRoleStatus === "non-schedulable";
  const ignored = sourceRoleStatus === "ignored";

  return {
    canCreateRequiredRows: primary,
    canCreateOptionGroups: primary,
    canCreateCreditBuckets: primary,
    canCreateCategoryOptions: primary,
    canCreateApprovedFilters: normalizedRole === "approved-course-list",
    canCreateElectiveLists: normalizedRole === "elective-list",
    canCreateSequencingHints:
      normalizedRole === "sample-schedule" || normalizedRole === "curriculum-map",
    canCreateAdmissionPrepRows:
      normalizedRole === "admission-prerequisite-source" ||
      normalizedRole === "admissions-preparation",
    canCreateScheduleRows: primary,
    supportOnly,
    nonSchedulable: nonSchedulable || ignored,
  };
}

function flattenRequirementSourceScope(sourceScope) {
  return {
    sourceScope,
    canCreateRequiredRows: sourceScope.canCreateRequiredRows,
    canCreateOptionGroups: sourceScope.canCreateOptionGroups,
    canCreateCreditBuckets: sourceScope.canCreateCreditBuckets,
    canCreateCategoryOptions: sourceScope.canCreateCategoryOptions,
    canCreateApprovedFilters: sourceScope.canCreateApprovedFilters,
    canCreateElectiveLists: sourceScope.canCreateElectiveLists,
    canCreateSequencingHints: sourceScope.canCreateSequencingHints,
    canCreateAdmissionPrepRows: sourceScope.canCreateAdmissionPrepRows,
    canCreateScheduleRows: sourceScope.canCreateScheduleRows,
    supportOnly: sourceScope.supportOnly,
    nonSchedulable: sourceScope.nonSchedulable,
  };
}

function canRequirementSourceRoleCreateSchedulableRows(sourceRole) {
  return buildRequirementSourceScope(sourceRole).canCreateScheduleRows;
}

function getBlockScopeBoolean(block, key, fallback) {
  if (typeof block?.[key] === "boolean") {
    return block[key];
  }
  if (block?.sourceScope && typeof block.sourceScope[key] === "boolean") {
    return block.sourceScope[key];
  }
  return fallback;
}

function isBlockSupportOnly(block) {
  return (
    block?.supportOnly === true ||
    block?.sourceRoleStatus === "support" ||
    getRequirementSourceRoleStatus(block?.sourceRole) === "support"
  );
}

function isBlockNonSchedulable(block) {
  return (
    block?.nonSchedulable === true ||
    block?.sourceRoleStatus === "non-schedulable" ||
    getRequirementSourceRoleStatus(block?.sourceRole) === "non-schedulable" ||
    getRequirementSourceRoleStatus(block?.sourceRole) === "ignored"
  );
}

function canParsedBlockCreateSchedulableRows(block) {
  if (
    block?.canCreateSchedulableRows === false ||
    block?.canCreateScheduleRows === false ||
    block?.canCreateRequiredRows === false ||
    block?.supportOnly === true ||
    block?.nonSchedulable === true
  ) {
    return false;
  }

  const role = block?.sourceRole ?? null;
  return !role || canRequirementSourceRoleCreateSchedulableRows(role);
}

module.exports = {
  IGNORED_SOURCE_ROLES,
  NON_SCHEDULABLE_SOURCE_ROLES,
  PARSEABLE_SUPPORT_ROLES,
  PRIMARY_SOURCE_ROLES,
  ROLE_STATUS_BY_ROLE,
  SUPPORT_SOURCE_ROLES,
  buildRequirementSourceScope,
  canParsedBlockCreateSchedulableRows,
  canRequirementSourceRoleCreateSchedulableRows,
  flattenRequirementSourceScope,
  getBlockScopeBoolean,
  getRequirementSourceRoleStatus,
  isBlockNonSchedulable,
  isBlockSupportOnly,
};
