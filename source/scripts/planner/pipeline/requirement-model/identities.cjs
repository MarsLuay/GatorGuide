
"use strict";
/** P03-A identities / ownership types (JSDoc contract). */

/**
 * @typedef {{ institutionId: string, displayName: string }} InstitutionRef
 * @typedef {{ campusId: string, institutionId: string, displayName: string }} CampusRef
 * @typedef {{ programId: string, campusId: string, displayName: string, stableId: string }} ProgramRef
 * @typedef {{ pathwayId: string, programId: string, displayName: string, stableId: string }} PathwayRef
 * @typedef {{ catalogYear: string }} CatalogYearRef
 * @typedef {{ ownerId: string, role: string, programId?: string }} SourceOwnerRef
 * @typedef {{
 *   requirementSetId: string,
 *   programId: string,
 *   catalogYear: string,
 *   sourceOwnerId: string,
 *   label: string,
 * }} RequirementSetIdentity
 */

function assertNonEmpty(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} required`);
  }
}

function createRequirementSetIdentity(input) {
  assertNonEmpty(input.requirementSetId, "requirementSetId");
  assertNonEmpty(input.programId, "programId");
  assertNonEmpty(input.catalogYear, "catalogYear");
  assertNonEmpty(input.sourceOwnerId, "sourceOwnerId");
  return {
    requirementSetId: input.requirementSetId,
    programId: input.programId,
    catalogYear: input.catalogYear,
    sourceOwnerId: input.sourceOwnerId,
    label: String(input.label || input.requirementSetId),
  };
}

function serializeIdentity(identity) {
  return JSON.stringify(identity);
}

module.exports = {
  createRequirementSetIdentity,
  serializeIdentity,
};
