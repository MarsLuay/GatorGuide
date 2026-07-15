
"use strict";
/** P03-C course constraints. */

function createCourseConstraint(input = {}) {
  if (!input.courseCode && !input.subject) {
    throw new Error("courseCode or subject required");
  }
  return {
    courseCode: input.courseCode || null,
    subject: input.subject || null,
    minGrade: input.minGrade || null,
    prerequisites: [...(input.prerequisites || [])],
    corequisites: [...(input.corequisites || [])],
    effectiveFrom: input.effectiveFrom || null,
    effectiveTo: input.effectiveTo || null,
    phase: input.phase || null,
    schedulable: input.schedulable !== false,
    transferRelevant: input.transferRelevant !== false,
  };
}

function assertSchedulableConstraint(constraint) {
  if (constraint.schedulable && !constraint.courseCode && !constraint.subject) {
    throw new Error("schedulable constraint needs courseCode or subject");
  }
  return true;
}

module.exports = {
  createCourseConstraint,
  assertSchedulableConstraint,
};
