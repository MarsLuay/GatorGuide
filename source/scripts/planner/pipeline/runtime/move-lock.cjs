"use strict";

/** P12 move/lock recalculation harness — stable course-instance IDs. */

function createCourseInstanceId({ code, quarterKey, occurrence = 0 }) {
  return `${String(code).toUpperCase().replace(/\s+/g, "")}@${quarterKey}#${occurrence}`;
}

function applyLock(plan, courseInstanceId) {
  const locks = new Set(plan.locks || []);
  locks.add(courseInstanceId);
  return { ...plan, locks: [...locks] };
}

function moveCourse(plan, courseInstanceId, toQuarterKey) {
  if ((plan.locks || []).includes(courseInstanceId)) {
    return {
      ok: false,
      conflict: "locked",
      courseInstanceId,
    };
  }
  const quarters = (plan.quarters || []).map((q) => ({
    ...q,
    courses: (q.courses || []).filter((c) => c.instanceId !== courseInstanceId),
  }));
  let moved = null;
  for (const q of plan.quarters || []) {
    moved = (q.courses || []).find((c) => c.instanceId === courseInstanceId);
    if (moved) break;
  }
  if (!moved) {
    return { ok: false, conflict: "missing", courseInstanceId };
  }
  const next = quarters.map((q) =>
    q.key === toQuarterKey
      ? {
          ...q,
          courses: [
            ...(q.courses || []),
            { ...moved, instanceId: createCourseInstanceId({ code: moved.code, quarterKey: toQuarterKey }) },
          ],
        }
      : q
  );
  if (!next.some((q) => q.key === toQuarterKey)) {
    next.push({
      key: toQuarterKey,
      courses: [
        {
          ...moved,
          instanceId: createCourseInstanceId({
            code: moved.code,
            quarterKey: toQuarterKey,
          }),
        },
      ],
    });
  }
  return { ok: true, plan: { ...plan, quarters: next } };
}

module.exports = { createCourseInstanceId, applyLock, moveCourse };
