const COURSE_CODE_PATTERN = /\b[A-Z]{2,8}&?\s*\d{3}(?:\.\d+)?[A-Z]?\b/g;

const COURSE_CODE_VALUE_KEYS = new Set([
  "acceptedUwCourseCodes",
  "alternatives",
  "compoundComponents",
  "conditionalLabCourses",
  "courseCode",
  "courseCodes",
  "courseLabels",
  "courses",
  "displayCourseCodes",
  "equivalentUwCourseCodes",
  "grcCourses",
  "grcMatches",
  "mappedGrcCourseCodes",
  "normalizedCourseCode",
  "recommendedCourses",
  "uwCourses",
]);

function normalizeCourseCode(value) {
  const normalized = String(value ?? "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
  const match = normalized.match(/^([A-Z&]+(?: [A-Z&]+)*) (\d{3}(?:\.\d+)?[A-Z]?)$/);
  if (!match) {
    return normalized;
  }

  const subjectTokens = match[1].split(" ").filter(Boolean);
  const normalizedSubject = subjectTokens.every((token) => token.length === 1)
    ? subjectTokens.join("")
    : subjectTokens.join(" ");

  return `${normalizedSubject} ${match[2]}`;
}

function collectCourseCodesFromValue(value, targetSet, courseBearingContext = false) {
  if (typeof value === "string") {
    if (!courseBearingContext) {
      return;
    }
    for (const match of value.match(COURSE_CODE_PATTERN) ?? []) {
      const normalized = normalizeCourseCode(match);
      if (normalized) {
        targetSet.add(normalized);
      }
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectCourseCodesFromValue(item, targetSet, courseBearingContext);
    }
    return;
  }

  if (value && typeof value === "object") {
    for (const [key, entryValue] of Object.entries(value)) {
      collectCourseCodesFromValue(
        entryValue,
        targetSet,
        courseBearingContext || COURSE_CODE_VALUE_KEYS.has(key)
      );
    }
  }
}

module.exports = {
  collectCourseCodesFromValue,
};
